import {
  chatService,
} from "./services/chatService";
import { SSE_HEADERS, sseEvent } from "./sse";
import { mergeHeaders } from "./http";
import { webSearch } from "./search";
import { buildPrompt, getFollowUps, streamAnswer } from "./llm";

export async function streamAssistantReply(params: {
  clerkUserId: string;
  chatId: string;
  query: string;
  headers: Headers;
  overrideWebSearch?: boolean;
}) {
  const { clerkUserId, chatId, query, headers, overrideWebSearch } = params;
  const context = await chatService.getChatContext(clerkUserId, chatId);
  const history = context.messages.slice(0, -1);
  const useWebSearch = typeof overrideWebSearch === "boolean"
    ? overrideWebSearch
    : context.settings.useWebSearch;

  const bodyStream = new ReadableStream({
    async start(controller) {
      try {
        const results = useWebSearch ? await webSearch(query) : [];
        controller.enqueue(sseEvent("sources", results));

        const assistantMeta = await chatService.buildAssistantMetadata(
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
        const persisted = await chatService.appendMessage({
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
