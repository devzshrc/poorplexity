const [
  { authenticateRequest, getClerkUser },
  {
    applySubscriptionSnapshot,
    appendMessage,
    archiveChat,
    branchChat,
    buildAssistantMetadata,
    createChat,
    createFolder,
    deleteFolder,
    deleteStoredUserData,
    exportUserData,
    findBillingUserBySubscriptionId,
    getBillingSummary,
    getChatContext,
    getChatDetail,
    getDailyUserMessageCount,
    getMessageEntitlement,
    getPublicProfile,
    getUsageDashboard,
    getWorkspace,
    markSubscriptionCheckoutPending,
    pinChat,
    recordBillingWebhookEvent,
    renameFolder,
    restoreChat,
    rewriteChatFromMessage,
    searchWorkspace,
    softDeleteChat,
    syncUser,
    updateChat,
    updateUserPreferences,
    updateUserProfile,
  },
  { SSE_HEADERS, sseEvent },
  { corsHeaders, getRequestOrigin, isAllowedOrigin, mergeHeaders },
  { webSearch },
  { buildPrompt, getFollowUps, streamAnswer },
  {
    billingEnabled,
    cancelSubscription,
    createPremiumSubscription,
    extractSubscriptionFromWebhook,
    fetchSubscription,
    getDailyMessageLimits,
    parseWebhookEvent,
    verifySubscriptionPaymentSignature,
    verifyWebhookSignature,
  },
] = await Promise.all([
  import("./src/auth"),
  import("./src/mongo"),
  import("./src/sse"),
  import("./src/http"),
  import("./src/search"),
  import("./src/llm"),
  import("./src/razorpay"),
]);

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: mergeHeaders(new Headers(headers), { "Content-Type": "application/json" }),
  });
}

function pathMatch(pathname: string, pattern: RegExp) {
  return pathname.match(pattern);
}

async function readJson<T>(req: Request): Promise<T> {
  return await req.json() as T;
}

async function requireUser(req: Request) {
  const auth = await authenticateRequest(req);
  const clerkUser = await getClerkUser(auth.userId);
  const userProfile = await syncUser(clerkUser);
  return { auth, clerkUser, userProfile };
}

async function streamAssistantReply(params: {
  clerkUserId: string;
  chatId: string;
  query: string;
  headers: Headers;
  overrideWebSearch?: boolean;
}) {
  const { clerkUserId, chatId, query, headers, overrideWebSearch } = params;
  const context = await getChatContext(clerkUserId, chatId);
  const history = context.messages.slice(0, -1);
  const useWebSearch = typeof overrideWebSearch === "boolean"
    ? overrideWebSearch
    : context.settings.useWebSearch;

  const bodyStream = new ReadableStream({
    async start(controller) {
      try {
        const results = useWebSearch ? await webSearch(query) : [];
        controller.enqueue(sseEvent("sources", results));

        const assistantMeta = await buildAssistantMetadata(
          clerkUserId,
          chatId,
          useWebSearch,
          results
        );
        controller.enqueue(sseEvent("context", assistantMeta.contextUsed));

        let assistantText = "";
        for await (const chunk of streamAnswer(
          buildPrompt(query, results, history, {
            chatTitle: context.title,
            conversationSummary: context.summary,
            systemPrompt: context.settings.systemPrompt,
            memoryNotes: assistantMeta.memoryNotes,
            outputFormat: context.settings.outputFormat,
            responseLength: context.settings.responseLength,
            roastLevel: context.settings.roastLevel,
            answerMode: context.settings.answerMode,
            onlyFromSources: context.settings.onlyFromSources,
            preferredModel: context.settings.preferredModel,
            useWebSearch,
          }),
          {
            outputFormat: context.settings.outputFormat,
            responseLength: context.settings.responseLength,
            roastLevel: context.settings.roastLevel,
            answerMode: context.settings.answerMode,
            onlyFromSources: context.settings.onlyFromSources,
            preferredModel: context.settings.preferredModel,
          }
        )) {
          assistantText += chunk;
          controller.enqueue(sseEvent("answer", chunk));
        }

        const followUps = await getFollowUps(query, assistantText, history).catch(() => []);
        const persisted = await appendMessage({
          clerkUserId,
          chatId,
          role: "assistant",
          content: assistantText.trim(),
          sources: results,
          followUps,
          contextUsed: assistantMeta.contextUsed,
          confidence: assistantMeta.confidence,
          webSearchUsed: useWebSearch,
        });

        controller.enqueue(sseEvent("followUps", followUps));
        controller.enqueue(sseEvent("chat", persisted.summary));
        controller.enqueue(sseEvent("confidence", assistantMeta.confidence));
        controller.enqueue(sseEvent("done", { chatId }));
      } catch (error) {
        controller.enqueue(
          sseEvent("error", {
            message: error instanceof Error ? error.message : String(error),
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(bodyStream, {
    headers: mergeHeaders(headers, SSE_HEADERS),
  });
}

const port = Number(process.env.PORT ?? "3598");

Bun.serve({
  port,

  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const origin = getRequestOrigin(req);
    const headers = corsHeaders(origin, {
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    });

    if (origin && !isAllowedOrigin(origin)) {
      return json({ error: "Origin not allowed" }, 403, headers);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      if (pathname === "/api/webhooks/razorpay" && req.method === "POST") {
        if (!billingEnabled()) {
          return json({ error: "Billing is not configured" }, 503, headers);
        }

        const signature = req.headers.get("x-razorpay-signature")?.trim();
        const eventId = req.headers.get("x-razorpay-event-id")?.trim();
        if (!signature || !eventId) {
          return json({ error: "Missing Razorpay webhook headers" }, 400, headers);
        }

        const rawBody = await req.text();
        if (!verifyWebhookSignature(rawBody, signature)) {
          return json({ error: "Invalid webhook signature" }, 401, headers);
        }

        const event = parseWebhookEvent(rawBody);
        const extracted = extractSubscriptionFromWebhook(event);
        const subscriptionId = extracted.subscription?.id ?? null;

        const duplicate = await recordBillingWebhookEvent({
          eventId,
          eventType: event.event,
          razorpaySubscriptionId: subscriptionId,
        });
        if (duplicate.duplicate) {
          return new Response(null, { status: 200, headers });
        }

        if (subscriptionId) {
          const linkedUser = await findBillingUserBySubscriptionId(subscriptionId);
          const clerkUserId = linkedUser?.clerkUserId
            ?? extracted.subscription?.notes?.clerk_user_id
            ?? null;

          if (clerkUserId) {
            const snapshot = await fetchSubscription(subscriptionId).catch(() => extracted.subscription);
            if (snapshot) {
              await applySubscriptionSnapshot({
                clerkUserId,
                subscription: snapshot,
                planName: linkedUser?.billing.planName ?? null,
                amountPaise: linkedUser?.billing.amountPaise ?? null,
                currency: linkedUser?.billing.currency ?? null,
                lastPaymentId: extracted.paymentId,
                failureReason: extracted.paymentFailureReason,
                webhookEventId: eventId,
                webhookReceivedAt: new Date(),
              });
            }
          }
        }

        return new Response(null, { status: 200, headers });
      }

      if (pathname === "/api/workspace" && req.method === "GET") {
        const { auth, userProfile } = await requireUser(req);
        const workspace = await getWorkspace(auth.userId);
        return json(
          {
            user: userProfile,
            folders: workspace.folders,
            chats: workspace.chats,
            trash: workspace.trash,
            usage: workspace.usage,
          },
          200,
          headers
        );
      }

      const publicProfileMatch = pathMatch(pathname, /^\/api\/public-profile\/([^/]+)$/);
      if (publicProfileMatch?.[1] && req.method === "GET") {
        return json(await getPublicProfile(publicProfileMatch[1]), 200, headers);
      }

      if (pathname === "/api/settings/profile" && req.method === "PATCH") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ displayName?: string; imageUrl?: string; bio?: string; publicUsername?: string }>(req);
        const user = await updateUserProfile(auth.userId, body);
        return json({ user }, 200, headers);
      }

      if (pathname === "/api/settings/preferences" && req.method === "PATCH") {
        const { auth } = await requireUser(req);
        const body = await readJson<{
          roastLevel?: "light" | "medium" | "high";
          responseLength?: "short" | "medium" | "long";
          outputFormat?: "bullets" | "paragraphs";
          answerMode?: "fast" | "balanced" | "deep";
          preferredModel?: string;
          onlyFromSources?: boolean;
          defaultFolderId?: string | null;
          memoryNotes?: string;
          hideChatSettingsPanel?: boolean;
        }>(req);
        const user = await updateUserPreferences(auth.userId, body);
        return json({ user }, 200, headers);
      }

      if (pathname === "/api/settings/export" && req.method === "GET") {
        const { auth } = await requireUser(req);
        return json(await exportUserData(auth.userId), 200, headers);
      }

      if (pathname === "/api/settings/usage" && req.method === "GET") {
        const { auth } = await requireUser(req);
        return json(await getUsageDashboard(auth.userId), 200, headers);
      }

      if (pathname === "/api/settings/data" && req.method === "DELETE") {
        const { auth } = await requireUser(req);
        await deleteStoredUserData(auth.userId);
        return new Response(null, { status: 204, headers });
      }

      if (pathname === "/api/billing" && req.method === "GET") {
        const { auth } = await requireUser(req);
        return json({
          billing: await getBillingSummary(auth.userId),
          limits: await getMessageEntitlement(auth.userId),
        }, 200, headers);
      }

      if (pathname === "/api/billing/subscribe" && req.method === "POST") {
        const { auth, userProfile } = await requireUser(req);
        if (!billingEnabled()) {
          return json({ error: "Billing is not configured" }, 503, headers);
        }

        const entitlement = await getMessageEntitlement(auth.userId);
        if (entitlement.billing?.isPremium) {
          return json({ error: "An active premium subscription already exists", billing: entitlement.billing }, 409, headers);
        }

        if (
          entitlement.billing?.razorpaySubscriptionId
          && entitlement.billing.status !== "cancelled"
          && entitlement.billing.status !== "completed"
          && entitlement.billing.status !== "expired"
        ) {
          const existing = await fetchSubscription(entitlement.billing.razorpaySubscriptionId).catch(() => null);
          if (existing && !["cancelled", "completed", "expired"].includes(existing.status)) {
            await applySubscriptionSnapshot({
              clerkUserId: auth.userId,
              subscription: existing,
              planName: entitlement.billing.planName,
              amountPaise: entitlement.billing.amountPaise,
              currency: entitlement.billing.currency,
              lastPaymentId: entitlement.billing.lastPaymentId,
              failureReason: entitlement.billing.failureReason,
            });

            return json({
              checkout: {
                key: process.env.RAZORPAY_KEY_ID,
                subscriptionId: existing.id,
                name: entitlement.billing.planName ?? "poorplexity Premium",
                description: "Premium subscription with a higher daily message allowance",
                amountPaise: entitlement.billing.amountPaise,
                currency: entitlement.billing.currency,
                prefill: {
                  name: userProfile.displayName,
                  email: userProfile.email,
                },
                theme: { color: "#e67e22" },
              },
              billing: await getBillingSummary(auth.userId),
            }, 200, headers);
          }
        }

        const created = await createPremiumSubscription({
          clerkUserId: auth.userId,
          email: userProfile.email,
          displayName: userProfile.displayName,
        });

        await markSubscriptionCheckoutPending({
          clerkUserId: auth.userId,
          subscription: created.subscription,
          planName: created.planName,
          amountPaise: created.amount,
          currency: created.currency,
        });

        return json({
          checkout: {
            key: created.checkoutKey,
            subscriptionId: created.subscription.id,
            name: created.planName,
            description: created.description,
            amountPaise: created.amount,
            currency: created.currency,
            prefill: {
              name: userProfile.displayName,
              email: userProfile.email,
            },
            theme: { color: "#e67e22" },
          },
          billing: await getBillingSummary(auth.userId),
        }, 200, headers);
      }

      if (pathname === "/api/billing/verify" && req.method === "POST") {
        const { auth } = await requireUser(req);
        if (!billingEnabled()) {
          return json({ error: "Billing is not configured" }, 503, headers);
        }

        const body = await readJson<{
          razorpay_payment_id?: string;
          razorpay_subscription_id?: string;
          razorpay_signature?: string;
        }>(req);

        const paymentId = body.razorpay_payment_id?.trim() || "";
        const clientSubscriptionId = body.razorpay_subscription_id?.trim() || "";
        const signature = body.razorpay_signature?.trim() || "";

        if (!paymentId || !clientSubscriptionId || !signature) {
          return json({ error: "Missing payment verification fields" }, 400, headers);
        }

        const billing = await getBillingSummary(auth.userId);
        const expectedSubscriptionId = billing.razorpaySubscriptionId;
        if (!expectedSubscriptionId || expectedSubscriptionId !== clientSubscriptionId) {
          return json({ error: "Subscription verification mismatch" }, 400, headers);
        }

        const verified = verifySubscriptionPaymentSignature({
          subscriptionId: expectedSubscriptionId,
          paymentId,
          signature,
        });
        if (!verified) {
          return json({ error: "Invalid payment signature" }, 401, headers);
        }

        const snapshot = await fetchSubscription(expectedSubscriptionId);
        const nextBilling = await applySubscriptionSnapshot({
          clerkUserId: auth.userId,
          subscription: snapshot,
          planName: billing.planName,
          amountPaise: billing.amountPaise,
          currency: billing.currency,
          lastPaymentId: paymentId,
          failureReason: null,
        });

        return json({ billing: nextBilling }, 200, headers);
      }

      if (pathname === "/api/billing/cancel" && req.method === "POST") {
        const { auth } = await requireUser(req);
        if (!billingEnabled()) {
          return json({ error: "Billing is not configured" }, 503, headers);
        }

        const body: { cancelAtCycleEnd?: boolean } = await readJson<{ cancelAtCycleEnd?: boolean }>(req).catch(() => ({}));
        const billing = await getBillingSummary(auth.userId);
        if (!billing.razorpaySubscriptionId) {
          return json({ error: "No active subscription found" }, 404, headers);
        }

        const snapshot = await cancelSubscription(
          billing.razorpaySubscriptionId,
          body.cancelAtCycleEnd !== false
        );
        const nextBilling = await applySubscriptionSnapshot({
          clerkUserId: auth.userId,
          subscription: snapshot,
          planName: billing.planName,
          amountPaise: billing.amountPaise,
          currency: billing.currency,
          lastPaymentId: billing.lastPaymentId,
          failureReason: billing.failureReason,
        });

        return json({ billing: nextBilling }, 200, headers);
      }

      if (pathname === "/api/search" && req.method === "GET") {
        const { auth } = await requireUser(req);
        const query = url.searchParams.get("q")?.trim() || "";
        return json(await searchWorkspace(auth.userId, query), 200, headers);
      }

      if (pathname === "/api/folders" && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ name?: string; parentFolderId?: string | null }>(req);
        const folder = await createFolder(auth.userId, body.name?.trim() || "", body.parentFolderId);
        return json({ folder }, 201, headers);
      }

      const folderMatch = pathMatch(pathname, /^\/api\/folders\/([^/]+)$/);
      const folderId = folderMatch?.[1];
      if (folderId && req.method === "PATCH") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ name?: string; parentFolderId?: string | null; isFavorite?: boolean }>(req);
        const folder = await renameFolder(auth.userId, folderId, body);
        return json({ folder }, 200, headers);
      }

      if (folderId && req.method === "DELETE") {
        const { auth } = await requireUser(req);
        await deleteFolder(auth.userId, folderId);
        return new Response(null, { status: 204, headers });
      }

      if (pathname === "/api/chats" && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{
          title?: string;
          folderId?: string | null;
          firstMessage?: string;
          branchFromChatId?: string | null;
          branchFromMessageId?: string | null;
        }>(req);
        const chat = await createChat({
          clerkUserId: auth.userId,
          title: body.title,
          folderId: body.folderId,
          firstMessage: body.firstMessage,
          branchFromChatId: body.branchFromChatId,
          branchFromMessageId: body.branchFromMessageId,
        });
        return json({ chat }, 201, headers);
      }

      const chatMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)$/);
      const chatIdFromPath = chatMatch?.[1];
      if (chatIdFromPath && req.method === "GET") {
        const { auth } = await requireUser(req);
        const chat = await getChatDetail(auth.userId, chatIdFromPath);
        return json({ chat }, 200, headers);
      }

      if (chatIdFromPath && req.method === "PATCH") {
        const { auth } = await requireUser(req);
        const body = await readJson<{
          title?: string;
          folderId?: string | null;
          isPinned?: boolean;
          isArchived?: boolean;
          systemPrompt?: string;
          useWebSearch?: boolean;
          answerMode?: "fast" | "balanced" | "deep";
          preferredModel?: string;
          responseLength?: "short" | "medium" | "long";
          outputFormat?: "bullets" | "paragraphs";
          roastLevel?: "light" | "medium" | "high";
          onlyFromSources?: boolean;
          contextWindow?: number;
        }>(req);
        const chat = await updateChat(auth.userId, chatIdFromPath, body);
        return json({ chat }, 200, headers);
      }

      if (chatIdFromPath && req.method === "DELETE") {
        const { auth } = await requireUser(req);
        await softDeleteChat(auth.userId, chatIdFromPath);
        return new Response(null, { status: 204, headers });
      }

      const archiveMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)\/archive$/);
      if (archiveMatch?.[1] && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ isArchived?: boolean }>(req);
        const chat = await archiveChat(auth.userId, archiveMatch[1], body.isArchived ?? true);
        return json({ chat }, 200, headers);
      }

      const pinMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)\/pin$/);
      if (pinMatch?.[1] && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ isPinned?: boolean }>(req);
        const chat = await pinChat(auth.userId, pinMatch[1], body.isPinned ?? true);
        return json({ chat }, 200, headers);
      }

      const restoreMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)\/restore$/);
      if (restoreMatch?.[1] && req.method === "POST") {
        const { auth } = await requireUser(req);
        const chat = await restoreChat(auth.userId, restoreMatch[1]);
        return json({ chat }, 200, headers);
      }

      const branchMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)\/branch$/);
      if (branchMatch?.[1] && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ messageId?: string | null }>(req);
        const chat = await branchChat(auth.userId, branchMatch[1], body.messageId);
        return json({ chat }, 201, headers);
      }

      const editMessageMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)\/edit-message$/);
      if (editMessageMatch?.[1] && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ messageId?: string; content?: string }>(req);
        const content = body.content?.trim() || "";
        if (!body.messageId || !content) {
          return json({ error: "messageId and content are required" }, 400, headers);
        }

        const chat = await rewriteChatFromMessage(auth.userId, editMessageMatch[1], body.messageId, content);
        return json({ chat }, 200, headers);
      }

      const regenerateMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)\/regenerate$/);
      if (regenerateMatch?.[1] && req.method === "POST") {
        const { auth } = await requireUser(req);
        const detail = await getChatDetail(auth.userId, regenerateMatch[1]);
        const lastUser = [...detail.messages].reverse().find((message) => message.role === "user");
        if (!lastUser) {
          return json({ error: "No user message to regenerate from" }, 400, headers);
        }
        await rewriteChatFromMessage(auth.userId, regenerateMatch[1], lastUser.id);
        return await streamAssistantReply({
          clerkUserId: auth.userId,
          chatId: regenerateMatch[1],
          query: lastUser.content,
          headers: new Headers(headers),
        });
      }

      const messageMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)\/messages$/);
      const messageChatId = messageMatch?.[1];
      if (messageChatId && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ content?: string; useWebSearch?: boolean }>(req);
        const content = body.content?.trim() || "";

        if (!content) return json({ error: "content is required" }, 400, headers);
        if (content.length > 4000) return json({ error: "content too long" }, 400, headers);

        const entitlement = await getMessageEntitlement(auth.userId);
        if (entitlement.dailyLimit !== null && entitlement.sentToday >= entitlement.dailyLimit) {
          return json(
            {
              error: "Daily message limit reached.",
              code: "DAILY_LIMIT_REACHED",
              billing: entitlement.billing,
              sentToday: entitlement.sentToday,
              dailyLimit: entitlement.dailyLimit,
              remainingToday: entitlement.remainingToday,
            },
            429,
            headers
          );
        }

        await appendMessage({
          clerkUserId: auth.userId,
          chatId: messageChatId,
          role: "user",
          content,
        });

        return await streamAssistantReply({
          clerkUserId: auth.userId,
          chatId: messageChatId,
          query: content,
          headers: new Headers(headers),
          overrideWebSearch: body.useWebSearch,
        });
      }

      return json({ error: "Not found" }, 404, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /Unauthorized/i.test(message)
        ? 401
        : /not found/i.test(message)
          ? 404
          : /limit/i.test(message)
            ? 429
            : 400;
      return json({ error: message }, status, headers);
    }
  },
});

console.log(`Server running on http://localhost:${port}`);
