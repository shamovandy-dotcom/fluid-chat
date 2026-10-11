"use client";

import { useMemo, useState } from "react";
import {
  AtSign,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Compass,
  FileText,
  Hash,
  Inbox,
  Lock,
  MessageSquare,
  MoreHorizontal,
  PenSquare,
  Plus,
  Отправить,
  Users
} from "lucide-react";
import type { ConversationSummary } from "@/shared/types";
import { api } from "../../api";
import { conversationTitle, useApp, useDirectory, type View } from "../../store";
import { Avatar, Badge, MenuDivider, MenuItem, Popover } from "../ui/primitives";

export function Sidebar() {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const workspace = state.bootstrap?.workspace;
  const conversations = state.bootstrap?.conversations ?? [];
  const isAdmin = state.bootstrap?.role === "owner" || state.bootstrap?.role === "admin";

  const groups = useMemo(() => {
    const visible = conversations.filter(
      (conversation) => !conversation.membership?.hidden || conversation.unreadCount > 0
    );
    const starred = visible.filter((conversation) => conversation.membership?.starred);
    const rest = visible.filter((conversation) => !conversation.membership?.starred);
    // Каналы read best alphabetically; DMs are most useful most-recent-first.
    const channels = rest
      .filter((conversation) => conversation.type === "channel")
      .sort((a, b) => (a.channel?.name ?? "").localeCompare(b.channel?.name ?? ""));
    const dms = rest
      .filter((conversation) => conversation.type !== "channel")
      .sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime());
    const sections = (state.bootstrap?.sections ?? []).map((section) => ({
      section,
      items: rest.filter((conversation) => conversation.membership?.sectionId === section.id)
    }));
    const sectioned = new Set(sections.flatMap((entry) => entry.items.map((item) => item.id)));
    return {
      starred,
      sections,
      channels: channels.filter((conversation) => !sectioned.has(conversation.id)),
      dms: dms.filter((conversation) => !sectioned.has(conversation.id))
    };
  }, [conversations, state.bootstrap?.sections]);

  const navItem = (view: View, label: string, icon: React.ReactNode, badge?: number) => {
    const active = state.view.kind === view.kind;
    return (
      <button type="button" className={`side-nav-item ${active ? "is-active" : ""}`} onClick={() => actions.setView(view)}>
        {icon}
        <span>{label}</span>
        {badge ? <Badge count={badge} mention /> : null}
      </button>
    );
  };

  return (
    <nav className="sidebar" aria-label="Навигация по рабочему пространству">
      <Popover
        width={280}
        trigger={({ toggle, ref }) => (
          <button type="button" className="workspace-button" onClick={toggle} ref={ref}>
            <span className="workspace-name">
              {workspace?.iconEmoji ? <span aria-hidden>{workspace.iconEmoji}</span> : null}
              {workspace?.name ?? "Workspace"}
            </span>
            <ChevronDown size={16} />
          </button>
        )}
      >
        {(close) => (
          <div className="menu">
            <div className="menu-heading">
              <strong>{workspace?.name}</strong>
              <span>{workspace?.slug}</span>
            </div>
            <MenuItem
              onClick={() => {
                actions.setModal({ kind: "invite" });
                close();
              }}
            >
              <Users size={14} /> Пригласить участников
            </MenuItem>
            <MenuItem
              onClick={() => {
                actions.setModal({ kind: "new-channel" });
                close();
              }}
            >
              <Hash size={14} /> Создать канал
            </MenuItem>
            {isAdmin ? (
              <MenuItem
                onClick={() => {
                  actions.setModal({ kind: "admin" });
                  close();
                }}
              >
                <MoreHorizontal size={14} /> Workspace settings
              </MenuItem>
            ) : null}
            <MenuDivider />
            <div className="menu-heading">
              <span>Switch workspace</span>
            </div>
            {state.memberships.map((membership) => (
              <MenuItem
                key={membership.workspace.id}
                onClick={() => {
                  void actions.selectWorkspace(membership.workspace.id);
                  close();
                }}
              >
                <span className="workspace-chip" aria-hidden>
                  {membership.workspace.name.slice(0, 1).toUpperCase()}
                </span>
                {membership.workspace.name}
              </MenuItem>
            ))}
            <MenuItem
              onClick={() => {
                actions.setModal({ kind: "create-workspace" });
                close();
              }}
            >
              <Plus size={14} /> Создать рабочее пространство
            </MenuItem>
          </div>
        )}
      </Popover>

      <div className="side-nav">
        {navItem({ kind: "threads" }, "Обсуждения", <MessageSquare size={16} />)}
        {navItem({ kind: "activity" }, "Активность", <AtSign size={16} />, state.unreadNotifications)}
        {navItem({ kind: "unreads" }, "Все непрочитанные", <Inbox size={16} />)}
        {navItem({ kind: "drafts" }, "Черновики и отправленные", <PenSquare size={16} />)}
        {navItem({ kind: "saved" }, "На потом", <Bookmark size={16} />)}
        {navItem({ kind: "files" }, "Файлы", <FileText size={16} />)}
        {navItem({ kind: "people" }, "Люди", <Users size={16} />)}
      </div>

      <div className="side-scroll">
        {groups.starred.length > 0 ? (
          <SidebarSection
            title="Избранное"
            collapsed={collapsed.starred}
            onToggle={() => setCollapsed((value) => ({ ...value, starred: !value.starred }))}
          >
            {groups.starred.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} />
            ))}
          </SidebarSection>
        ) : null}

        {groups.sections.map(({ section, items }) => (
          <SidebarSection
            key={section.id}
            title={section.name}
            collapsed={collapsed[section.id]}
            onToggle={() => setCollapsed((value) => ({ ...value, [section.id]: !value[section.id] }))}
          >
            {items.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} />
            ))}
            {items.length === 0 ? <p className="side-empty">Drag conversations here from their ⋯ menu.</p> : null}
          </SidebarSection>
        ))}

        <SidebarSection
          title="Каналы"
          collapsed={collapsed.channels}
          onToggle={() => setCollapsed((value) => ({ ...value, channels: !value.channels }))}
          action={
            <Popover
              width={240}
              align="end"
              trigger={({ toggle, ref }) => (
                <button type="button" className="section-action" ref={ref} onClick={toggle} aria-label="Добавить каналы">
                  <Plus size={14} />
                </button>
              )}
            >
              {(close) => (
                <div className="menu">
                  <MenuItem
                    onClick={() => {
                      actions.setView({ kind: "browse" });
                      close();
                    }}
                  >
                    <Compass size={14} /> Browse channels
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      actions.setModal({ kind: "new-channel" });
                      close();
                    }}
                  >
                    <Plus size={14} /> Создать канал
                  </MenuItem>
                </div>
              )}
            </Popover>
          }
        >
          {groups.channels.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} />
          ))}
          <button type="button" className="side-row is-muted" onClick={() => actions.setView({ kind: "browse" })}>
            <Plus size={15} />
            <span className="side-label">Добавить каналы</span>
          </button>
        </SidebarSection>

        <SidebarSection
          title="Личные сообщения"
          collapsed={collapsed.dms}
          onToggle={() => setCollapsed((value) => ({ ...value, dms: !value.dms }))}
          action={
            <button
              type="button"
              className="section-action"
              onClick={() => actions.setModal({ kind: "new-dm" })}
              aria-label="Новое личное сообщение"
            >
              <Plus size={14} />
            </button>
          }
        >
          {groups.dms.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} />
          ))}
          {groups.dms.length === 0 ? (
            <button type="button" className="side-row is-muted" onClick={() => actions.setModal({ kind: "new-dm" })}>
              <Отправить size={15} />
              <span className="side-label">Start a conversation</span>
            </button>
          ) : null}
        </SidebarSection>
      </div>

      {state.session ? (
        <div className="sidebar-footer">
          <Avatar user={state.session} size={26} />
          <span className="side-label">{state.session.displayName}</span>
          {!state.connected ? <span className="connection-dot" title="Повторное подключение…" /> : null}
        </div>
      ) : null}
    </nav>
  );
}

function SidebarSection({
  title,
  children,
  collapsed,
  onToggle,
  action
}: {
  title: string;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <section className="side-section">
      <div className="side-section-head">
        <button type="button" onClick={onToggle} aria-expanded={!collapsed}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          {title}
        </button>
        {action}
      </div>
      {!collapsed ? <div className="side-section-body">{children}</div> : null}
    </section>
  );
}

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const active = state.view.kind === "conversation" && state.view.conversationId === conversation.id;
  const unread = conversation.unreadCount > 0;
  const title = conversationTitle(conversation, directory, state.session?.id);
  const otherId = conversation.memberIds.find((id) => id !== state.session?.id);
  const other = conversation.type === "dm" && otherId ? directory.get(otherId) : undefined;
  const draft = state.drafts[`${conversation.id}:root`];

  return (
    <div className={`side-row-wrap ${active ? "is-active" : ""}`}>
      <button
        type="button"
        className={`side-row ${unread ? "is-unread" : ""}`}
        onClick={(event) => void actions.openConversation(conversation.id, { newTab: event.metaKey || event.ctrlKey, background: (event.metaKey || event.ctrlKey) && !event.shiftKey })}
        onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); void actions.openConversation(conversation.id, { newTab: true, background: true }); } }}
      >
        {conversation.channel ? (
          conversation.channel.visibility === "private" ? (
            <Lock size={14} />
          ) : (
            <Hash size={15} />
          )
        ) : conversation.type === "group_dm" ? (
          <Users size={15} />
        ) : (
          <Avatar user={other} size={20} />
        )}
        <span className="side-label">{title}</span>
        {draft?.trim() ? <span className="draft-dot" title="Черновик" /> : null}
        {conversation.mentionCount > 0 ? (
          <Badge count={conversation.mentionCount} mention />
        ) : conversation.unreadCount > 0 ? (
          <Badge count={conversation.unreadCount} />
        ) : null}
      </button>

      <Popover
        width={240}
        align="end"
        trigger={({ toggle, ref }) => (
          <button type="button" className="side-row-menu" ref={ref} onClick={toggle} aria-label={`Options for ${title}`}>
            <MoreHorizontal size={14} />
          </button>
        )}
      >
        {(close) => (
          <div className="menu">
            <MenuItem onClick={() => { close(); void actions.openConversation(conversation.id, { newTab: true }); }}>Open in new chat tab</MenuItem>
            <MenuDivider />
            <MenuItem
              onClick={async () => {
                close();
                await api.conversations.updateMembership(conversation.id, {
                  starred: !conversation.membership?.starred
                });
                await actions.refreshConversations();
              }}
            >
              {conversation.membership?.starred ? "Удалить from starred" : "Добавить в избранное"}
            </MenuItem>
            <MenuItem
              onClick={async () => {
                close();
                await api.conversations.updateMembership(conversation.id, { muted: !conversation.membership?.muted });
                await actions.refreshConversations();
              }}
            >
              {conversation.membership?.muted ? "Unmute conversation" : "Отключить уведомления"}
            </MenuItem>
            <MenuItem
              onClick={async () => {
                close();
                await api.conversations.markRead(conversation.id);
                await actions.refreshConversations();
              }}
            >
              Отметить как прочитанное
            </MenuItem>
            <MenuItem
              onClick={async () => {
                close();
                await api.conversations.markUnread(conversation.id);
                await actions.refreshConversations();
              }}
            >
              Mark as unread
            </MenuItem>
            {state.bootstrap?.sections.length ? <MenuDivider /> : null}
            {state.bootstrap?.sections.map((section) => (
              <MenuItem
                key={section.id}
                onClick={async () => {
                  close();
                  await api.conversations.updateMembership(conversation.id, { sectionId: section.id });
                  await actions.refreshConversations();
                }}
              >
                Move to {section.name}
              </MenuItem>
            ))}
            <MenuDivider />
            {conversation.type === "channel" && conversation.channel ? (
              <MenuItem
                danger
                onClick={async () => {
                  close();
                  try {
                    await api.channels.leave(conversation.channel!.id);
                    await actions.refreshBootstrap();
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                Leave channel
              </MenuItem>
            ) : (
              <MenuItem
                onClick={async () => {
                  close();
                  await api.conversations.updateMembership(conversation.id, { hidden: true });
                  await actions.refreshConversations();
                }}
              >
                Закрыть conversation
              </MenuItem>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}
