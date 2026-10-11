"use client";

import { useEffect, useRef } from "react";
import { notificationsPaused } from "@/shared/quiet-hours";
import { ALERTING_NOTIFICATION_TYPES, AppProvider, useApp } from "../store";
import { AuthScreen, WorkspaceSetupScreen } from "./auth-screen";
import { Sidebar } from "./shell/sidebar";
import { WorkspaceRail } from "./shell/workspace-rail";
import { TopBar } from "./shell/top-bar";
import { RightPanel } from "./shell/right-panel";
import { ChatTabBar } from "./shell/chat-tab-bar";
import { ConversationView } from "./shell/conversation-view";
import { АктивностьView, DraftsView, СохранитьdView, ОбсуждениеsView, НепрочитанныеView } from "./views/activity-views";
import { BrowseКаналыView, ФайлыView, ЛюдиView, ПоискView } from "./views/directory-views";
import { QuickSwitcher } from "./modals/quick-switcher";
import { АдминистрированиеConsole } from "./modals/admin-console";
import {
  AddЛюдиModal,
  СоздатьWorkspaceModal,
  ПригласитьModal,
  NewChannelModal,
  NewDmModal,
  ПредпочтенияModal,
  ПрофильИзменитьorModal,
  ScheduleModal,
  ShareModal,
  ShortcutsModal,
  СтатусModal
} from "./modals/modals";
import { Spinner } from "./ui/primitives";

export function App() {
  return (
    <AppProvider>
      <AppRoot />
    </AppProvider>
  );
}

function AppRoot() {
  const { state, actions } = useApp();

  useTheme();
  useHotkeys();
  useDesktopУведомления();
  useDeepСсылка();

  if (state.status === "loading") {
    return (
      <div classИмя="boot-screen">
        <Spinner label="Загрузка Androlit Chat" />
      </div>
    );
  }

  if (state.status === "anonymous" || !state.session) return <AuthScreen />;
  if (state.memberships.length === 0) return <WorkspaceSetupScreen />;

  return (
    <div classИмя={`app-shell ${state.sidebarOpen ? "sidebar-open" : ""}`}>
      <TopBar />
      <div classИмя="app-body">
        <WorkspaceRail />
        <Sidebar />
        {state.sidebarOpen ? (
          <button
            type="button"
            classИмя="sidebar-scrim"
            aria-label="Закрыть навигацию"
            onClick={() => actions.setSidebarOpen(false)}
          />
        ) : null}
        <div classИмя="conversation-workspace">
          <ChatTabBar />
          <div classИмя="conversation-workspace-body">
            <main classИмя="app-main" id="chat-tab-content" aria-label="Содержимое переписки">
              {state.view.kind === "conversation" ? <ConversationView key={state.view.conversationId} conversationId={state.view.conversationId} /> : null}
              {state.view.kind === "activity" ? <АктивностьView /> : null}
              {state.view.kind === "threads" ? <ОбсуждениеsView /> : null}
              {state.view.kind === "saved" ? <СохранитьdView /> : null}
              {state.view.kind === "drafts" ? <DraftsView /> : null}
              {state.view.kind === "unreads" ? <НепрочитанныеView /> : null}
              {state.view.kind === "browse" ? <BrowseКаналыView /> : null}
              {state.view.kind === "people" ? <ЛюдиView /> : null}
              {state.view.kind === "files" ? <ФайлыView /> : null}
              {state.view.kind === "search" ? <ПоискView query={state.view.query} /> : null}
            </main>
            <RightPanel />
          </div>
        </div>
      </div>
      <Modals />
      <Toasts />
    </div>
  );
}

function Modals() {
  const { state, actions } = useApp();
  const close = () => actions.setModal(null);
  const modal = state.modal;
  if (!modal) return null;

  switch (modal.kind) {
    case "quick-switcher":
      return <QuickSwitcher onЗакрыть={close} newTab={modal.newTab} />;
    case "preferences":
      return <ПредпочтенияModal onЗакрыть={close} />;
    case "admin":
      return <АдминистрированиеConsole onЗакрыть={close} />;
    case "invite":
      return <ПригласитьModal onЗакрыть={close} />;
    case "new-channel":
      return <NewChannelModal onЗакрыть={close} />;
    case "new-dm":
      return <NewDmModal onЗакрыть={close} />;
    case "add-people":
      return <AddЛюдиModal conversationId={modal.conversationId} onЗакрыть={close} />;
    case "shortcuts":
      return <ShortcutsModal onЗакрыть={close} />;
    case "status":
      return <СтатусModal onЗакрыть={close} />;
    case "profile-editor":
      return <ПрофильИзменитьorModal onЗакрыть={close} />;
    case "create-workspace":
      return <СоздатьWorkspaceModal onЗакрыть={close} />;
    case "schedule":
      return (
        <ScheduleModal
          conversationId={modal.conversationId}
          bodyText={modal.bodyText}
          parentСообщениеId={modal.parentСообщениеId}
          onЗакрыть={close}
        />
      );
    case "share":
      return <ShareModal messageId={modal.messageId} onЗакрыть={close} />;
    default:
      return null;
  }
}

function Toasts() {
  const { state, actions } = useApp();

  useEffect(() => {
    if (state.toasts.length === 0) return;
    const timer = setTimeout(() => actions.dismissToast(state.toasts[0].id), 5000);
    return () => clearTimeout(timer);
  }, [state.toasts, actions]);

  if (state.toasts.length === 0) return null;
  return (
    <div classИмя="toast-stack" role="status" aria-live="polite">
      {state.toasts.map((toast) => (
        <button key={toast.id} type="button" classИмя={`toast is-${toast.tone}`} onClick={() => actions.dismissToast(toast.id)}>
          {toast.text}
        </button>
      ))}
    </div>
  );
}

/** Applies the theme preference, following the OS when set to `system`. */
function useTheme() {
  const { state } = useApp();
  const theme = state.session?.preferences?.theme ?? "system";
  const density = state.session?.preferences?.messageDensity ?? "comfortable";

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.dataset.theme = resolved;
      root.dataset.density = density;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, density]);
}

function useHotkeys() {
  const { state, actions } = useApp();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // App shortcuts deliberately avoid the browser's own tab shortcuts.
      if (event.altKey && !event.metaKey && !event.ctrlKey && !state.modal) {
        const key = event.code.startsWith("Key") ? event.code.slice(3).toLowerCase() : event.code.startsWith("Digit") ? event.code.slice(5) : event.key.toLowerCase();
        if (event.shiftKey && ["n", "w", "t"].includes(key)) {
          event.preventDefault();
          if (event.code === "KeyN" || key === "n") actions.setModal({ kind: "quick-switcher", newTab: true });
          if (event.code === "KeyW" || key === "w") {
            if (state.view.kind === "conversation") actions.changeChatTabs({ type: "close", conversationId: state.view.conversationId });
          }
          if (event.code === "KeyT" || key === "t") actions.changeChatTabs({ type: "reopen" });
          return;
        }
        if (!event.shiftKey && /^[1-9]$/.test(key)) {
          const index = key === "9" ? state.chatTabs.items.length - 1 : Number(key) - 1;
          const tab = state.chatTabs.items[index];
          if (tab) { event.preventDefault(); void actions.openConversation(tab.conversationId); }
          return;
        }
      }
      const meta = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagИмя === "INPUT" || target?.tagИмя === "TEXTAREA" || target?.isContentИзменитьable;

      if (meta && event.key.toLowerCase() === "k" && !event.shiftKey) {
        event.preventDefault();
        actions.setModal({ kind: "quick-switcher" });
        return;
      }
      if (meta && event.key === "/") {
        event.preventDefault();
        actions.setModal({ kind: "shortcuts" });
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        actions.setModal({ kind: "new-dm" });
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        actions.setView({ kind: "unreads" });
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        actions.setView({ kind: "threads" });
        return;
      }
      // Alt+↑/↓ walks the sidebar, the way Slack moves between conversations.
      if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        const conversations = state.bootstrap?.conversations.filter(
          (conversation) => !conversation.membership?.hidden || conversation.unreadCount > 0
        );
        if (conversations && conversations.length > 0) {
          event.preventDefault();
          const activeId = state.view.kind === "conversation" ? state.view.conversationId : null;
          const current = activeId ? conversations.findIndex((conversation) => conversation.id === activeId) : -1;
          const step = event.key === "ArrowDown" ? 1 : -1;
          const next = (current + step + conversations.length) % conversations.length;
          void actions.openConversation(conversations[next].id);
        }
        return;
      }

      if (event.shiftKey && event.key === "Escape") {
        event.preventDefault();
        void actions.markEverythingRead();
        return;
      }

      if (event.key === "Escape" && !typing) {
        if (state.modal) actions.setModal(null);
        else if (state.rightPanel) actions.setRightPanel(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, state.modal, state.rightPanel, state.view, state.chatTabs, state.bootstrap]);
}

/**
 * Desktop banners for activity that arrives while the app is not in front.
 *
 * Everything already in the list on the first run is treated as seen, so a
 * reload or a refetch never replays yesterday's mentions, and each id fires at
 * most once — three mentions in a row raise three banners rather than only the
 * newest surviving as `notifications[0]`.
 */
function useDesktopУведомления() {
  const { state, actions } = useApp();
  const session = state.session;
  const preference = session?.preferences?.desktopУведомления ?? "mentions";
  const notifications = state.notifications;
  const paused = notificationsPaused({
    quietHours: { start: session?.preferences?.quietHoursStart, end: session?.preferences?.quietHoursEnd },
    timeZone: session?.timezone,
    dndUntil: session?.dndUntil
  });

  const seen = useRef<Set<string> | null>(null);
  const loadedAt = useRef(Date.now());
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const known = seen.current;
    seen.current = new Set(notifications.map((entry) => entry.id));
    // The first list only seeds the baseline; nothing on it is new to this tab.
    if (!known) return;

    const fresh = notifications.filter(
      (entry) =>
        !known.has(entry.id) &&
        !entry.readAt &&
        // The list is also filled by refetches, which can pull in unread rows
        // that predate this tab. Those are history, not an interruption.
        new Date(entry.createdAt).getTime() >= loadedAt.current
    );
    if (fresh.length === 0 || preference === "none" || paused) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    // `visibilityState` alone is not enough: a tab sitting behind another app is
    // still "visible", which is exactly when someone wants to be told.
    if (document.visibilityState === "visible" && document.hasFocus()) return;

    for (const entry of fresh.slice(0, 3).reverse()) {
      const relevant = ALERTING_NOTIFICATION_TYPES.includes(entry.type);
      if (preference === "mentions" && !relevant) continue;
      const banner = new Notification("Androlit Chat", {
        body: entry.body ?? "New activity",
        tag: entry.id,
        icon: "/icon.svg"
      });
      banner.onclick = () => {
        window.focus();
        if (entry.conversationId) void actionsRef.current.openConversation(entry.conversationId);
        banner.close();
      };
    }
  }, [notifications, preference, paused]);
}

/** `/?conversation=…&message=…` opens a permalink from a copied message link. */
function useDeepСсылка() {
  const { state, actions } = useApp();

  useEffect(() => {
    if (!state.bootstrap) return;
    const params = new URLПоискParams(window.location.search);
    const conversationId = params.get("conversation");
    if (!conversationId) return;
    void actions.openConversation(conversationId).then(() => {
      const messageId = params.get("message");
      if (messageId) {
        requestAnimationFrame(() => {
          document.querySelector(`[data-message-id="${messageId}"]`)?.scrollIntoView({ block: "center" });
        });
      }
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, [state.bootstrap?.workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
