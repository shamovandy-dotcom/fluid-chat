"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Hash, Lock, MoreHorizontal, Pencil, Pin, Plus, Users, X } from "lucide-react";
import { conversationTitle, useApp, useDirectory } from "../../store";
import { Avatar, MenuDivider, MenuItem, Popover } from "../ui/primitives";

type Drop = { index: number; id: string; side: "before" | "after" };
type Drag = { id: string; pointerId: number; startX: number; startY: number; x: number; y: number; dragging: boolean; drop: Drop | null };

export function ChatTabBar() {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const list = useRef<HTMLDivElement>(null);
  const dragPreview = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabs = state.chatTabs.items;
  const activeId = state.view.kind === "conversation" ? state.view.conversationId : null;
  const conversations = new Map(state.bootstrap?.conversations.map(conversation => [conversation.id, conversation]));
  const title = (id: string) => conversationTitle(conversations.get(id) ?? null, directory, state.session?.id);
  const tabIcon = (id: string) => {
    const conversation = conversations.get(id);
    if (conversation?.channel) return conversation.channel.visibility === "private" ? <Lock size={14} /> : <Hash size={15} />;
    if (conversation?.type === "dm") {
      const partner = conversation.memberIds.find(id => id !== state.session?.id);
      return <Avatar user={partner ? directory.get(partner) : undefined} size={20} presence={false} />;
    }
    return <Users size={15} />;
  };

  useEffect(() => {
    const strip = list.current;
    if (!strip) return;
    const revealActive = () => {
      const element = Array.from(strip.querySelectorAll<HTMLElement>("[data-chat-tab]")).find(element => element.dataset.chatTab === activeId);
      element?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [activeId, tabs.length]);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const close = (event: globalThis.PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMenu(null); focusTab(menu.id); }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menu]);

  // Compute insertion points from the actual, possibly scrolled tab geometry.
  // Pinned tabs stay in their own group, just as they do in a browser.
  useEffect(() => {
    if (!draggingId) return;
    let frame: number;
    const update = () => {
      const current = drag.current;
      const strip = list.current;
      if (!current || !strip) return;
      if (dragPreview.current) dragPreview.current.style.transform = `translate(${current.x - 32}px, ${current.y - 18}px)`;
      const bounds = strip.getBoundingClientRect();
      const edge = 36;
      if (current.x < bounds.left + edge) strip.scrollLeft -= Math.min(15, (bounds.left + edge - current.x) / 3);
      if (current.x > bounds.right - edge) strip.scrollLeft += Math.min(15, (current.x - bounds.right + edge) / 3);
      const pinned = tabs.find(tab => tab.conversationId === current.id)?.pinned;
      const peers = tabs.filter(tab => tab.conversationId !== current.id && tab.pinned === pinned);
      const elements = new Map(Array.from(strip.querySelectorAll<HTMLElement>("[data-chat-tab]")).map(element => [element.dataset.chatTab, element]));
      let index = peers.findIndex(tab => {
        const rect = elements.get(tab.conversationId)?.getBoundingClientRect();
        return rect && current.x < rect.left + rect.width / 2;
      });
      if (index < 0) index = peers.length;
      const peer = peers[index] ?? peers.at(-1);
      const next = peer ? { index: index + (pinned ? 0 : tabs.filter(tab => tab.pinned).length), id: peer.conversationId, side: index < peers.length ? "before" as const : "after" as const } : null;
      current.drop = next;
      setDrop(previous => previous?.index === next?.index && previous?.id === next?.id && previous?.side === next?.side ? previous : next);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [draggingId, tabs]);

  function focusTab(id: string) {
    requestAnimationFrame(() => document.getElementById(`chat-tab-${id}`)?.focus());
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, id: string) {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".chat-tab-close, .chat-tab-menu")) return;
    suppressClick.current = false;
    drag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false, drop: null };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (!current.dragging && Math.abs(current.x - current.startX) > 5) {
      event.currentTarget.setPointerCapture(event.pointerId);
      current.dragging = true;
      suppressClick.current = true;
      setMenu(null);
      setDraggingId(current.id);
    }
    if (current.dragging) event.preventDefault();
  }

  function endDrag(cancelled = false) {
    const current = drag.current;
    if (current?.dragging && current.drop && !cancelled) {
      actions.changeChatTabs({ type: "move", conversationId: current.id, index: current.drop.index });
      setAnnouncement(`${title(current.id)} moved to position ${current.drop.index + 1}`);
      focusTab(current.id);
    }
    drag.current = null;
    setDraggingId(null);
    setDrop(null);
    // Keep the synthetic click following pointerup from activating a moved tab.
    if (current?.dragging) window.setTimeout(() => { suppressClick.current = false; }, 0);
  }

  function closeTab(id: string) {
    const index = tabs.findIndex(tab => tab.conversationId === id);
    const next = tabs[index + 1] ?? tabs[index - 1];
    actions.changeChatTabs({ type: "close", conversationId: id });
    setAnnouncement(`${title(id)} tab closed. The conversation and draft are saved.`);
    if (next) focusTab(next.conversationId);
    else requestAnimationFrame(() => document.getElementById("new-chat-tab")?.focus());
  }

  function openMenu(id: string, x: number, y: number) {
    setMenu({ id, x: Math.max(8, Math.min(x, window.innerWidth - 256)), y: Math.max(8, Math.min(y, window.innerHeight - 330)) });
  }

  const menuIndex = menu ? tabs.findIndex(tab => tab.conversationId === menu.id) : -1;
  return (
    <div className="chat-tabs-bar" aria-label="Chat tabs">
      <div className="chat-tabs-list" role="tablist" aria-label="Open conversations" ref={list}>
        {tabs.map((tab, index) => {
          const id = tab.conversationId;
          const label = title(id);
          const conversation = conversations.get(id);
          const draft = Boolean(state.drafts[`${id}:root`]?.trim() || state.composerAttachments[`${id}:root`]?.length);
          const unread = conversation?.unreadCount ?? 0;
          const mentions = conversation?.mentionCount ?? 0;
          return (
            <div key={id} data-chat-tab={id} className={`chat-tab ${activeId === id ? "is-active" : ""} ${tab.pinned ? "is-pinned" : ""} ${draggingId === id ? "is-dragging" : ""} ${drop?.id === id ? `drop-${drop.side}` : ""}`}
              onPointerDown={event => startDrag(event, id)} onPointerMove={moveDrag}
              onPointerUp={() => endDrag()} onPointerCancel={() => endDrag(true)} onLostPointerCapture={() => { if (drag.current) endDrag(true); }}
              onContextMenu={event => { event.preventDefault(); openMenu(id, event.clientX, event.clientY); }}
              onAuxClick={event => { if (event.button === 1) { event.preventDefault(); closeTab(id); } }}>
              <button type="button" className="chat-tab-select" role="tab" id={`chat-tab-${id}`} aria-controls="chat-tab-content" aria-selected={activeId === id}
                tabIndex={activeId === id || (!activeId && index === 0) ? 0 : -1}
                aria-label={`${label}${tab.pinned ? ", pinned" : ""}${draft ? ", unsent draft" : ""}${unread ? `, ${unread} unread messages` : ""}`}
                title={`${label}${draft ? " · Unsent draft" : ""}${tab.pinned ? " · Pinned" : ""}`}
                onClick={() => { if (!suppressClick.current) void actions.openConversation(id); }}
                onKeyDown={event => {
                  if (event.key === "Escape" && drag.current?.dragging) { event.preventDefault(); endDrag(true); return; }
                  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(id, rect.left, rect.bottom); return;
                  }
                  if (event.key === "Delete") { event.preventDefault(); closeTab(id); return; }
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
                  if (event.altKey && event.shiftKey && event.key.startsWith("Arrow")) {
                    const target = Math.max(0, Math.min(tabs.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
                    actions.changeChatTabs({ type: "move", conversationId: id, index: target });
                    setAnnouncement(`${label} tab reordered`); focusTab(id);
                  } else { void actions.openConversation(tabs[nextIndex].conversationId); focusTab(tabs[nextIndex].conversationId); }
                }}>
                {tabIcon(id)}<span className="chat-tab-label">{label}</span>
                {tab.pinned ? <Pin className="chat-tab-pin" size={11} aria-hidden /> : null}
                {draft ? <Pencil className="chat-tab-draft" size={12} aria-hidden /> : null}
                {unread > 0 ? <span className={`chat-tab-unread ${mentions ? "has-mentions" : ""}`} aria-hidden>{Math.min(mentions || unread, 99)}{(mentions || unread) > 99 ? "+" : ""}</span> : null}
              </button>
              <button type="button" className="chat-tab-menu" aria-label={`Tab options for ${label}`} title="Tab options" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); openMenu(id, rect.left, rect.bottom); }}><MoreHorizontal size={13} /></button>
              {!tab.pinned ? <button type="button" className="chat-tab-close" aria-label={`Close ${label} tab`} title="Close tab" onClick={() => closeTab(id)}><X size={14} /></button> : null}
            </div>
          );
        })}
        {tabs.length === 0 ? <span className="chat-tabs-empty">Open a conversation to get started</span> : null}
      </div>
      <button type="button" className="icon-button new-chat-tab" id="new-chat-tab" aria-label="Open chat in new tab" title="Open chat in new tab (Alt+Shift+N)" onClick={() => actions.setModal({ kind: "quick-switcher", newTab: true })}><Plus size={18} /></button>
      <Popover width={300} align="end" trigger={({ toggle, ref }) => <button type="button" className="icon-button" ref={ref} onClick={toggle} aria-label="All open tabs" title="All open tabs"><ChevronDown size={17} /></button>}>
        {close => <div className="menu"><div className="menu-heading"><strong>Open tabs</strong></div>
          {tabs.map(tab => <MenuItem key={tab.conversationId} onClick={() => { close(); void actions.openConversation(tab.conversationId); }}>{tabIcon(tab.conversationId)}<span className="chat-tab-overflow-label">{title(tab.conversationId)}</span>{tab.pinned ? <Pin size={12} /> : null}</MenuItem>)}
          <MenuDivider /><MenuItem disabled={!state.chatTabs.closed.length} onClick={() => { close(); actions.changeChatTabs({ type: "reopen" }); }}>Reopen closed tab</MenuItem>
        </div>}
      </Popover>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      {draggingId ? createPortal(
        <div className="chat-tab-drag-preview" ref={dragPreview} aria-hidden="true"
          style={{ transform: `translate(${(drag.current?.x ?? 0) - 32}px, ${(drag.current?.y ?? 0) - 18}px)` }}>
          {tabIcon(draggingId)}<span className="chat-tab-label">{title(draggingId)}</span>
        </div>, document.body
      ) : null}
      {menu && menuIndex >= 0 ? createPortal(
        <div className="chat-tab-context menu" role="menu" aria-label={`Options for ${title(menu.id)}`} ref={menuRef} style={{ left: menu.x, top: menu.y }}
          onKeyDown={event => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length;
            buttons[index]?.focus();
          }}>
          <button type="button" role="menuitem" className="menu-item" onClick={() => { actions.changeChatTabs({ type: "pin", conversationId: menu.id }); focusTab(menu.id); setMenu(null); }}>{tabs[menuIndex].pinned ? "Unpin tab" : "Pin tab"}</button>
          <button type="button" role="menuitem" className="menu-item" disabled={menuIndex === 0 || tabs[menuIndex - 1]?.pinned !== tabs[menuIndex].pinned} onClick={() => { actions.changeChatTabs({ type: "move", conversationId: menu.id, index: menuIndex - 1 }); focusTab(menu.id); setMenu(null); }}>Move tab left</button>
          <button type="button" role="menuitem" className="menu-item" disabled={menuIndex === tabs.length - 1 || tabs[menuIndex + 1]?.pinned !== tabs[menuIndex].pinned} onClick={() => { actions.changeChatTabs({ type: "move", conversationId: menu.id, index: menuIndex + 1 }); focusTab(menu.id); setMenu(null); }}>Move tab right</button>
          <MenuDivider />
          <button type="button" role="menuitem" className="menu-item" onClick={() => { closeTab(menu.id); setMenu(null); }}>Close tab</button>
          <button type="button" role="menuitem" className="menu-item" disabled={!tabs.some(tab => tab.conversationId !== menu.id && !tab.pinned)} onClick={() => { actions.changeChatTabs({ type: "close", conversationId: menu.id, scope: "others" }); focusTab(menu.id); setMenu(null); }}>Close other tabs</button>
          <button type="button" role="menuitem" className="menu-item" disabled={!tabs.slice(menuIndex + 1).some(tab => !tab.pinned)} onClick={() => { actions.changeChatTabs({ type: "close", conversationId: menu.id, scope: "right" }); focusTab(menu.id); setMenu(null); }}>Close tabs to the right</button>
          <MenuDivider />
          <button type="button" role="menuitem" className="menu-item" disabled={!state.chatTabs.closed.length} onClick={() => { actions.changeChatTabs({ type: "reopen" }); setMenu(null); }}>Reopen closed tab</button>
        </div>, document.body
      ) : null}
    </div>
  );
}
