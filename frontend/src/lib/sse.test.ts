import { describe, expect, test } from "bun:test";
import { consumeStream } from "./sse";
import type { ChatSummary, Source } from "@/types/api";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("consumeStream", () => {
  test("dispatches server-sent events", async () => {
    const events: string[] = [];
    const sources: Source[] = [{ title: "Doc", url: "https://example.com", content: "Example" }];
    const chat: ChatSummary = {
      id: "chat_1",
      title: "Example",
      folderId: null,
      updatedAt: new Date(0).toISOString(),
      lastMessageAt: new Date(0).toISOString(),
      lastMessagePreview: "",
      lastMessageRole: "assistant",
      messageCount: 2,
      isPinned: false,
      isArchived: false,
      branchFromChatId: null,
      branchFromMessageId: null,
    };

    const res = new Response(sse("sources", sources) + sse("answer", "hi") + sse("chat", chat));
    await consumeStream(res, {
      onSources: (items) => events.push(`sources:${items.length}`),
      onAnswer: (chunk) => events.push(`answer:${chunk}`),
      onFollowUps: (items) => events.push(`followUps:${items.length}`),
      onChat: (item) => events.push(`chat:${item.id}`),
      onContext: (items) => events.push(`context:${items.length}`),
      onConfidence: (value) => events.push(`confidence:${value}`),
      onDone: () => events.push("done"),
      onError: (message) => events.push(`error:${message}`),
    }, new AbortController().signal);

    expect(events).toEqual(["sources:1", "answer:hi", "chat:chat_1", "done"]);
  });
});
