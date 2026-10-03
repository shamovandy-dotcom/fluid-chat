import { describe, expect, it } from "vitest";
import { chatTabsStorageKey, emptyChatTabs, reduceChatTabs, restoreChatTabs, type ChatTabs } from "@/client/chat-tabs";

function openTabs(...ids: string[]): ChatTabs {
  return ids.reduce((state, conversationId) => reduceChatTabs(state, { type: "open", conversationId, newTab: true }), emptyChatTabs);
}
const ids = (state: ChatTabs) => state.items.map(tab => tab.conversationId);

describe("chat tab navigation", () => {
  it("reuses existing conversations and replaces only the active ordinary tab", () => {
    let state = openTabs("design", "general", "maya");
    state = reduceChatTabs(state, { type: "open", conversationId: "design", newTab: true });
    expect(ids(state)).toEqual(["design", "general", "maya"]);
    state = reduceChatTabs(state, { type: "open", conversationId: "launch" });
    expect(ids(state)).toEqual(["launch", "general", "maya"]);
    expect(state.activeId).toBe("launch");
  });

  it("opens background tabs next to the active tab without stealing focus", () => {
    let state = openTabs("design", "general");
    state = reduceChatTabs(state, { type: "open", conversationId: "design" });
    state = reduceChatTabs(state, { type: "open", conversationId: "maya", background: true });
    expect(ids(state)).toEqual(["design", "maya", "general"]);
    expect(state.activeId).toBe("design");
    expect(reduceChatTabs(state, { type: "open", conversationId: "general", background: true }).activeId).toBe("design");
  });

  it("keeps a pinned conversation when navigating elsewhere", () => {
    let state = openTabs("design", "general");
    state = reduceChatTabs(state, { type: "pin", conversationId: "general" });
    state = reduceChatTabs(state, { type: "open", conversationId: "maya" });
    expect(ids(state)).toEqual(["general", "maya", "design"]);
    expect(state.items[0].pinned).toBe(true);
  });
});

describe("closing and reopening chat tabs", () => {
  it("leaves focus alone when a background tab closes, then chooses the right neighbor", () => {
    let state = openTabs("a", "b", "c", "d");
    state = reduceChatTabs(state, { type: "open", conversationId: "b" });
    state = reduceChatTabs(state, { type: "close", conversationId: "a" });
    expect(state.activeId).toBe("b");
    state = reduceChatTabs(state, { type: "close", conversationId: "b" });
    expect(state.activeId).toBe("c");
    expect(reduceChatTabs(state, { type: "reopen" })).toMatchObject({ activeId: "b", items: [{ conversationId: "b" }, { conversationId: "c" }, { conversationId: "d" }] });
  });

  it("closes the final tab and can reopen it", () => {
    const closed = reduceChatTabs(openTabs("a"), { type: "close", conversationId: "a" });
    expect(closed.activeId).toBeNull();
    expect(closed.items).toEqual([]);
    expect(reduceChatTabs(closed, { type: "reopen" }).activeId).toBe("a");
  });

  it("preserves pinned tabs when closing other tabs and tabs to the right", () => {
    let state = openTabs("a", "b", "c", "d");
    state = reduceChatTabs(state, { type: "pin", conversationId: "a" });
    expect(ids(reduceChatTabs(state, { type: "close", conversationId: "c", scope: "others" }))).toEqual(["a", "c"]);
    expect(ids(reduceChatTabs(state, { type: "close", conversationId: "b", scope: "right" }))).toEqual(["a", "b"]);
  });

  it("never duplicates a conversation reopened manually before undo-close", () => {
    let state = reduceChatTabs(openTabs("a", "b"), { type: "close", conversationId: "b" });
    state = reduceChatTabs(state, { type: "open", conversationId: "b", newTab: true });
    state = reduceChatTabs(state, { type: "reopen" });
    expect(ids(state)).toEqual(["a", "b"]);
    expect(state.closed).toEqual([]);
  });

  it("bounds the closed-tab history", () => {
    let state = emptyChatTabs;
    for (let i = 0; i < 30; i++) {
      state = reduceChatTabs(state, { type: "open", conversationId: String(i) });
      state = reduceChatTabs(state, { type: "close", conversationId: String(i) });
    }
    expect(state.closed).toHaveLength(20);
  });
});

describe("reordering and restoring chat tabs", () => {
  it("moves left and right without changing the active conversation", () => {
    const start = openTabs("a", "b", "c");
    const moved = reduceChatTabs(start, { type: "move", conversationId: "a", index: 2 });
    expect(ids(moved)).toEqual(["b", "c", "a"]);
    expect(moved.activeId).toBe("c");
    expect(ids(reduceChatTabs(moved, { type: "move", conversationId: "a", index: 0 }))).toEqual(ids(start));
    expect(ids(start)).toEqual(["a", "b", "c"]);
  });

  it("clamps drag destinations to the pinned or ordinary group", () => {
    let state = openTabs("a", "b", "c", "d");
    state = reduceChatTabs(state, { type: "pin", conversationId: "a" });
    state = reduceChatTabs(state, { type: "pin", conversationId: "b" });
    expect(ids(reduceChatTabs(state, { type: "move", conversationId: "d", index: 0 }))).toEqual(["a", "b", "d", "c"]);
    expect(ids(reduceChatTabs(state, { type: "move", conversationId: "a", index: 99 }))).toEqual(["b", "a", "c", "d"]);
    expect(reduceChatTabs(state, { type: "move", conversationId: "a", index: NaN })).toBe(state);
  });

  it("rejects inaccessible, duplicate and malformed saved tabs", () => {
    const state = restoreChatTabs({ items: [null, { conversationId: "a" }, { conversationId: "a" }, { conversationId: "secret" }, { conversationId: "b", pinned: true }], activeId: "secret", closed: [null, { tab: { conversationId: "secret" }, index: 0 }] }, new Set(["a", "b"]));
    expect(ids(state)).toEqual(["b", "a"]);
    expect(state.activeId).toBe("b");
    expect(state.closed).toEqual([]);
    expect(restoreChatTabs("broken", new Set())).toEqual(emptyChatTabs);
  });

  it("restores order, pins, active conversation and reopen history", () => {
    let state = openTabs("a", "b", "c");
    state = reduceChatTabs(state, { type: "pin", conversationId: "b" });
    state = reduceChatTabs(state, { type: "close", conversationId: "c" });
    expect(restoreChatTabs(JSON.parse(JSON.stringify(state)), new Set(["a", "b", "c"]))).toEqual(state);
    expect(chatTabsStorageKey("alice", "team")).not.toBe(chatTabsStorageKey("bob", "team"));
    expect(chatTabsStorageKey("alice", "team")).not.toBe(chatTabsStorageKey("alice", "other-team"));
  });
});
