"use client";

import { useEffect, useState } from "react";
import { AtSign, Bell, Bookmark, Clock, Inbox, СообщениеSquare, PenSquare, Trash2 } from "lucide-react";
import type { DraftDto, СообщениеDto, NotificationDto, ReminderDto, ScheduledСообщениеDto } from "@/shared/types";
import { api } from "../../api";
import { formatRelative, compactTimestamp } from "../../format";
import { conversationTitle, useApp, useDirectory } from "../../store";
import { Avatar, EmptyState, Spinner } from "../ui/primitives";
import { СообщениеItem } from "../message/message-item";
import { RichText } from "../message/rich-text";

function ViewHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header classИмя="view-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function useConversationLabel() {
  const { state } = useApp();
  const directory = useDirectory();
  return (conversationId: string | null) => {
    if (!conversationId) return "";
    const conversation = state.bootstrap?.conversations.find((entry) => entry.id === conversationId);
    if (!conversation) return "a conversation";
    return conversation.channel
      ? `#${conversation.channel.name}`
      : conversationTitle(conversation, directory, state.session?.id);
  };
}

export function АктивностьView() {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const label = useConversationLabel();
  const [notifications, setУведомления] = useState<NotificationDto[] | null>(null);
  const [filter, setFilter] = useState<"all" | "mention" | "thread_reply" | "reaction">("all");

  useEffect(() => {
    if (!state.workspaceId) return;
    api.activity
      .notifications(state.workspaceId)
      .then(({ notifications: list }) => setУведомления(list))
      .catch(() => setУведомления([]));
  }, [state.workspaceId, state.notifications.length]);

  const visible = (notifications ?? []).filter((entry) => filter === "all" || entry.type === filter);

  return (
    <section classИмя="view">
      <ViewHeader
        title="Активность"
        subtitle="Упоминания, ответы и реакции"
        action={
          <button
            type="button"
            classИмя="button ghost"
            onClick={async () => {
              if (!state.workspaceId) return;
              await api.activity.markУведомленияRead(state.workspaceId);
              await actions.loadУведомления();
              setУведомления((current) =>
                (current ?? []).map((entry) => ({ ...entry, readAt: entry.readAt ?? new Date().toISOString() }))
              );
            }}
          >
            Отметить всё прочитанным
          </button>
        }
      />
      <div classИмя="view-filters">
        {(
          [
            ["all", "All", <Bell key="a" size={14} />],
            ["mention", "Mentions", <AtSign key="b" size={14} />],
            ["thread_reply", "Обсуждениеs", <СообщениеSquare key="c" size={14} />],
            ["reaction", "Reactions", <Bookmark key="d" size={14} />]
          ] as const
        ).map(([value, text, icon]) => (
          <button
            key={value}
            type="button"
            classИмя={filter === value ? "is-active" : ""}
            onClick={() => setFilter(value as typeof filter)}
          >
            {icon}
            {text}
          </button>
        ))}
      </div>

      <div classИмя="view-scroll">
        {!notifications ? (
          <Spinner label="Загрузка активности" />
        ) : visible.length === 0 ? (
          <EmptyState title="Вы are all caught up" body="Здесь отображаются упоминания, ответы в обсуждениях и реакции." />
        ) : (
          visible.map((notification) => {
            const actor = notification.actorUserId ? directory.get(notification.actorUserId) : undefined;
            return (
              <button
                key={notification.id}
                type="button"
                classИмя={`activity-row ${notification.readAt ? "" : "is-unread"}`}
                onClick={() => {
                  if (notification.conversationId) void actions.openConversation(notification.conversationId);
                }}
              >
                <Avatar user={actor} size={34} />
                <div>
                  <div classИмя="activity-meta">
                    <strong>{actor?.displayИмя ?? "Fluid Chat"}</strong>
                    <span>{describeNotification(notification.type)}</span>
                    <span classИмя="muted">{label(notification.conversationId)}</span>
                    <time>{formatRelative(notification.createdAt)}</time>
                  </div>
                  {notification.body ? <p classИмя="activity-body">{notification.body}</p> : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function describeNotification(type: string) {
  switch (type) {
    case "mention":
      return "mentioned you in";
    case "dm":
      return "sent you a message";
    case "thread_reply":
      return "replied in a thread in";
    case "reaction":
      return "reacted to your message in";
    case "invite_accepted":
      return "joined the workspace";
    case "reminder":
      return "reminder";
    case "keyword":
      return "said a keyword you follow in";
    case "channel_invite":
      return "added you to a channel";
    default:
      return type;
  }
}

export function ОбсуждениеsView() {
  const { state, actions } = useApp();
  const label = useConversationLabel();
  const [threads, setОбсуждениеs] = useState<Array<{ root: СообщениеDto; replies: СообщениеDto[] }> | null>(null);

  useEffect(() => {
    if (!state.workspaceId) return;
    api.activity
      .threads(state.workspaceId)
      .then(({ threads: list }) => setОбсуждениеs(list))
      .catch(() => setОбсуждениеs([]));
  }, [state.workspaceId]);

  return (
    <section classИмя="view">
      <ViewHeader title="Обсуждениеs" subtitle="Переписки, в которых вы участвуете" />
      <div classИмя="view-scroll">
        {!threads ? (
          <Spinner label="Загрузка обсужденияs" />
        ) : threads.length === 0 ? (
          <EmptyState title="Пока нет обсуждений" body="Ответьте на сообщение в обсуждении — оно появится здесь." />
        ) : (
          threads.map(({ root, replies }) => (
            <div key={root.id} classИмя="thread-card">
              <button type="button" classИмя="thread-card-head" onClick={() => void actions.openОбсуждение(root.id)}>
                {label(root.conversationId)}
                <span>
                  {root.thread.replyCount} {root.thread.replyCount === 1 ? "reply" : "replies"}
                </span>
              </button>
              <СообщениеItem message={root} context="list" />
              {replies.map((reply) => (
                <СообщениеItem key={reply.id} message={reply} context="list" />
              ))}
              <button type="button" classИмя="button ghost" onClick={() => void actions.openОбсуждение(root.id)}>
                Open thread
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function СохранитьdView() {
  const { state } = useApp();
  const [saved, setСохранитьd] = useState<Array<{ message: СообщениеDto; savedAt: string }> | null>(null);

  useEffect(() => {
    if (!state.workspaceId) return;
    api.activity
      .saved(state.workspaceId)
      .then(({ saved: list }) => setСохранитьd(list))
      .catch(() => setСохранитьd([]));
  }, [state.workspaceId]);

  return (
    <section classИмя="view">
      <ViewHeader title="На потом" subtitle="Сохранённые сообщения" />
      <div classИмя="view-scroll">
        {!saved ? (
          <Spinner label="Загрузка сохранённых сообщений" />
        ) : saved.length === 0 ? (
          <EmptyState title="Пока ничего не сохранено" body="Нажмите на значок закладки у сообщения, чтобы сохранить его здесь." />
        ) : (
          saved.map(({ message, savedAt }) => (
            <div key={message.id} classИмя="panel-card">
              <div classИмя="panel-card-head">
                <Bookmark size={13} /> Сохранитьd {formatRelative(savedAt)}
              </div>
              <СообщениеItem message={message} context="list" />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function DraftsView() {
  const { state, actions } = useApp();
  const label = useConversationLabel();
  const [drafts, setDrafts] = useState<DraftDto[] | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledСообщениеDto[]>([]);
  const [reminders, setReminders] = useState<ReminderDto[]>([]);

  const load = () => {
    if (!state.workspaceId) return;
    void api.activity.drafts(state.workspaceId).then(({ drafts: list }) => setDrafts(list));
    void api.activity.scheduled(state.workspaceId).then(({ scheduled: list }) => setScheduled(list));
    void api.activity.reminders(state.workspaceId).then(({ reminders: list }) => setReminders(list));
  };

  useEffect(load, [state.workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section classИмя="view">
      <ViewHeader title="Черновики и отправленные" subtitle="Черновикs, scheduled messages and reminders" />
      <div classИмя="view-scroll">
        <h3 classИмя="view-subhead">
          <PenSquare size={14} /> Drafts
        </h3>
        {!drafts ? (
          <Spinner label="Загрузка черновиков" />
        ) : drafts.filter((draft) => draft.bodyText.trim()).length === 0 ? (
          <EmptyState title="Нет черновиков" body="Здесь хранятся начатые, но не отправленные сообщения." />
        ) : (
          drafts
            .filter((draft) => draft.bodyText.trim())
            .map((draft) => (
              <button
                key={draft.id}
                type="button"
                classИмя="list-row"
                onClick={() => void actions.openConversation(draft.conversationId)}
              >
                <div classИмя="list-row-head">
                  <strong>{label(draft.conversationId)}</strong>
                  <time>{formatRelative(draft.updatedAt)}</time>
                </div>
                <RichText text={draft.bodyText} />
              </button>
            ))
        )}

        <h3 classИмя="view-subhead">
          <Clock size={14} /> Scheduled
        </h3>
        {scheduled.length === 0 ? (
          <p classИмя="muted padded">Nothing scheduled.</p>
        ) : (
          scheduled.map((entry) => (
            <div key={entry.id} classИмя="list-row is-static">
              <div classИмя="list-row-head">
                <strong>{label(entry.conversationId)}</strong>
                <time>Отправитьs {compactTimestamp(entry.sendAt)}</time>
                <button
                  type="button"
                  classИмя="icon-button"
                  aria-label="Отменить запланированное сообщение"
                  onClick={async () => {
                    await api.activity.cancelScheduled(entry.id);
                    load();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <RichText text={entry.bodyText} />
            </div>
          ))
        )}

        <h3 classИмя="view-subhead">
          <Bell size={14} /> Reminders
        </h3>
        {reminders.length === 0 ? (
          <p classИмя="muted padded">No reminders set.</p>
        ) : (
          reminders.map((reminder) => (
            <div key={reminder.id} classИмя="list-row is-static">
              <div classИмя="list-row-head">
                <strong>{reminder.text}</strong>
                <time>{compactTimestamp(reminder.remindAt)}</time>
                <button
                  type="button"
                  classИмя="button ghost"
                  onClick={async () => {
                    await api.activity.completeReminder(reminder.id);
                    load();
                  }}
                >
                  Complete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function UnreadsView() {
  const { state, actions } = useApp();
  const label = useConversationLabel();
  const [unreads, setUnreads] = useState<Array<{ conversationId: string; messages: СообщениеDto[] }> | null>(null);

  const load = () => {
    if (!state.workspaceId) return;
    api.activity
      .unreads(state.workspaceId)
      .then(({ unreads: list }) => setUnreads(list))
      .catch(() => setUnreads([]));
  };

  useEffect(load, [state.workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section classИмя="view">
      <ViewHeader
        title="Все непрочитанные"
        subtitle="Все сообщения, которые вы ещё не прочитали"
        action={
          <button
            type="button"
            classИмя="button ghost"
            onClick={async () => {
              for (const entry of unreads ?? []) {
                await api.conversations.markRead(entry.conversationId, entry.messages.at(-1)?.id);
              }
              await actions.refreshConversations();
              load();
            }}
          >
            <Inbox size={14} /> Отметить всё прочитанным
          </button>
        }
      />
      <div classИмя="view-scroll">
        {!unreads ? (
          <Spinner label="Загрузка непрочитанных сообщений" />
        ) : unreads.length === 0 ? (
          <EmptyState title="Вы are all caught up" body="Непрочитанных сообщений нет." />
        ) : (
          unreads.map((entry) => (
            <div key={entry.conversationId} classИмя="unread-group">
              <button type="button" classИмя="unread-group-head" onClick={() => void actions.openConversation(entry.conversationId)}>
                {label(entry.conversationId)}
                <span>{entry.messages.length} new</span>
              </button>
              {entry.messages.map((message) => (
                <СообщениеItem key={message.id} message={message} context="list" />
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
