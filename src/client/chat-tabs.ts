export type ChatTab = { conversationId: string; pinned: boolean };
export type ChatTabs = {
  items: ChatTab[];
  activeId: string | null;
  closed: Array<{ tab: ChatTab; index: number }>;
};

export const emptyChatTabs: ChatTabs = { items: [], activeId: null, closed: [] };

export type ChatTabAction =
  | { type: "open"; conversationId: string; newTab?: boolean; background?: boolean }
  | { type: "close"; conversationId: string; scope?: "others" | "right" }
  | { type: "reopen" }
  | { type: "pin"; conversationId: string }
  | { type: "move"; conversationId: string; index: number };

/** One tab per conversation. Pinned tabs always precede ordinary tabs. */
export function reduceChatTabs(state: ChatTabs, action: ChatTabAction): ChatTabs {
  const items = [...state.items];
  switch (action.type) {
    case "open": {
      if (items.some(tab => tab.conversationId === action.conversationId)) {
        return { ...state, activeId: action.background ? state.activeId : action.conversationId };
      }
      const tab = { conversationId: action.conversationId, pinned: false };
      const index = items.findIndex(entry => entry.conversationId === state.activeId);
      if (!action.newTab && !action.background && index >= 0 && !items[index].pinned) items[index] = tab;
      else items.splice(index >= 0 ? Math.max(index + 1, items.filter(entry => entry.pinned).length) : items.length, 0, tab);
      return { ...state, items, activeId: action.background && state.activeId ? state.activeId : tab.conversationId };
    }
    case "close": {
      const index = items.findIndex(tab => tab.conversationId === action.conversationId);
      if (index < 0) return state;
      const removed = items.flatMap((tab, i) => {
        const close = action.scope === "others" ? i !== index && !tab.pinned
          : action.scope === "right" ? i > index && !tab.pinned : i === index;
        return close ? [{ tab, index: i }] : [];
      });
      const removedIds = new Set(removed.map(entry => entry.tab.conversationId));
      const remaining = items.filter(tab => !removedIds.has(tab.conversationId));
      const activeIndex = items.findIndex(tab => tab.conversationId === state.activeId);
      const activeId = removedIds.has(state.activeId ?? "")
        ? items.slice(activeIndex + 1).find(tab => !removedIds.has(tab.conversationId))?.conversationId
          ?? items.slice(0, activeIndex).reverse().find(tab => !removedIds.has(tab.conversationId))?.conversationId ?? null
        : state.activeId;
      return { items: remaining, activeId, closed: [...state.closed, ...removed].slice(-20) };
    }
    case "reopen": {
      const entry = state.closed.at(-1);
      if (!entry) return state;
      const closed = state.closed.slice(0, -1);
      if (items.some(tab => tab.conversationId === entry.tab.conversationId)) {
        return { ...state, activeId: entry.tab.conversationId, closed };
      }
      const pinned = items.filter(tab => tab.pinned).length;
      const index = entry.tab.pinned ? Math.min(entry.index, pinned) : Math.max(pinned, Math.min(entry.index, items.length));
      items.splice(index, 0, entry.tab);
      return { items, activeId: entry.tab.conversationId, closed };
    }
    case "pin": {
      const index = items.findIndex(tab => tab.conversationId === action.conversationId);
      if (index < 0) return state;
      const [tab] = items.splice(index, 1);
      items.splice(items.filter(entry => entry.pinned).length, 0, { ...tab, pinned: !tab.pinned });
      return { ...state, items };
    }
    case "move": {
      const index = items.findIndex(tab => tab.conversationId === action.conversationId);
      if (index < 0 || !Number.isFinite(action.index)) return state;
      const [tab] = items.splice(index, 1);
      const pinned = items.filter(entry => entry.pinned).length;
      const target = tab.pinned ? Math.max(0, Math.min(action.index, pinned)) : Math.max(pinned, Math.min(action.index, items.length));
      items.splice(target, 0, tab);
      return { ...state, items };
    }
  }
}

/** Ignore stale/inaccessible IDs and malformed browser storage. */
export function restoreChatTabs(value: unknown, allowedIds: Set<string>): ChatTabs {
  if (!value || typeof value !== "object") return emptyChatTabs;
  const data = value as Partial<ChatTabs>;
  const seen = new Set<string>();
  const items: ChatTab[] = [];
  for (const tab of Array.isArray(data.items) ? data.items : []) {
    if (!tab || typeof tab.conversationId !== "string" || !allowedIds.has(tab.conversationId) || seen.has(tab.conversationId)) continue;
    seen.add(tab.conversationId);
    items.push({ conversationId: tab.conversationId, pinned: tab.pinned === true });
  }
  items.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const closed = (Array.isArray(data.closed) ? data.closed : []).filter(entry =>
    entry?.tab && allowedIds.has(entry.tab.conversationId) && Number.isInteger(entry.index) && entry.index >= 0
  ).slice(-20).map(entry => ({ tab: { conversationId: entry.tab.conversationId, pinned: entry.tab.pinned === true }, index: entry.index }));
  return { items, activeId: data.activeId && seen.has(data.activeId) ? data.activeId : items[0]?.conversationId ?? null, closed };
}

export function chatTabsStorageKey(userId: string, workspaceId: string) {
  return `fluidchat:tabs:${userId}:${workspaceId}`;
}
