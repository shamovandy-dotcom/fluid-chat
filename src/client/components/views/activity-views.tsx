"use client";

import { useEffect, useState } from "react";
import { AtSign, Bell, Bookmark, Clock, Inbox, MessageSquare, PenSquare, Trash2 } from "lucide-react";
import type { DraftDto, MessageDto, NotificationDto, ReminderDto, ScheduledMessageDto } from "@/shared/types";
import { api } from "../../api";
import { formatRelative, compactTimestamp } from "../../format";
import { conversationTitle, useApp, useDirectory } from "../../store";
import { Avatar, EmptyState, Spinner } from "../ui/primitives";
import { MessageItem } from "../message/message-item";
import { RichText } from "../message/rich-text";

function ViewHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="view-header">
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

export function ActivityView() {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const label = useConversationLabel();
  const [notifications, setNotifications] = useState<NotificationDto[] | null>(null);
  const [filter, setFilter] = useState<"all" | "mention" | "thread_reply" | "reaction">("all");

  useEffect(() => {
    if (!state.workspaceId) return;
    api.activity
      .notifications(state.workspaceId)
      .then(({ notifications: list }) => setNotifications(list))
      .catch(() => setNotifications([]));
  }, [state.workspaceId, state.notifications.length]);

  const visible = (notifications ?? []).filter((entry) => filter === "all" || entry.type === filter);

  return (
    <section className="view">
      <ViewHeader
        title="Активность"
        subtitle="Упоминания, ответы и реакции"
        action={
          <button
            type="button"
            className="button ghost"
            onClick={async () => {
              if (!state.workspaceId) return;
              await api.activity.markNotificationsRead(state.workspaceId);
              await actions.loadNotifications();
              setNotifications((current) =>
                (current ?? []).map((entry) => ({ ...entry, readAt: entry.readAt ?? new Date().toISOString() }))
              );
            }}
          >
            Отметить всё прочитанным
          </button>
        }
      />
      <div className="view-filters">
        {(
          [
            ["all", "Все", <Bell key="a" size={14} />],
            ["mention", "Упоминания", <AtSign key="b" size={14} />],
            ["thread_reply", "Обсуждения", <MessageSquare key="c" size={14} />],
            ["reaction", "Реакции", <Bookmark key="d" size={14} />]
          ] as const
        ).map(([value, text, icon]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "is-active" : ""}
            onClick={() => setFilter(value as typeof filter)}
          >
            {icon}
            {text}
          </button>
        ))}
      </div>

      <div className="view-scroll">
        {!notifications ? (
          <Spinner label="Загрузка активности" />
        ) : visible.length === 0 ? (
          <EmptyState title="Вы всё просмотрели" body="Здесь отображаются упоминания, ответы в обсуждениях и реакции." />
        ) : (
          visible.map((notification) => {
            const actor = notification.actorUserId ? directory.get(notification.actorUserId) : undefined;
            return (
              <button
                key={notification.id}
                type="button"
                className={`activity-row ${notification.readAt ? "" : "is-unread"}`}
                onClick={() => {
                  if (notification.conversationId) void actions.openConversation(notification.conversationId);
                }}
              >
                <Avatar user={actor} size={34} />
                <div>
                  <div className="activity-meta">
                    <strong>{actor?.displayName ?? "Fluid Chat"}</strong>
                    <span>{describeNotification(notification.type)}</span>
                    <span className="muted">{label(notification.conversationId)}</span>
                    <time>{formatRelative(notification.createdAt)}</time>
                  </div>
                  {notification.body ? <p className="activity-body">{notification.body}</p> : null}
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
      return "упомянул вас в";
    case "dm":
      return "отправил вам сообщение";
    case "thread_reply":
      return "ответил в обсуждении в";
    case "reaction":
      return "отреагировал на ваше сообщение в";
    case "invite_accepted":
      return "присоединился к рабочему пространству";
    case "reminder":
      return "напоминание";
    case "keyword":
      return "использовал отслеживаемое вами слово в";
    case "channel_invite":
      return "добавил вас в канал";
    default:
      return type;
  }
}

export function ThreadsView() {
  const { state, actions } = useApp();
  const label = useConversationLabel();
  const [threads, setThreads] = useState<Array<{ root: MessageDto; replies: MessageDto[] }> | null>(null);

  useEffect(() => {
    if (!state.workspaceId) return;
    api.activity
      .threads(state.workspaceId)
      .then(({ threads: list }) => setThreads(list))
      .catch(() => setThreads([]));
  }, [state.workspaceId]);

  return (
    <section className="view">
      <ViewHeader title="Обсуждения" subtitle="Переписки, в которых вы участвуете" />
      <div className="view-scroll">
        {!threads ? (
          <Spinner label="Загрузка обсуждений" />
        ) : threads.length === 0 ? (
          <EmptyState title="Пока нет обсуждений" body="Ответьте на сообщение в обсуждении — оно появится здесь." />
        ) : (
          threads.map(({ root, replies }) => (
            <div key={root.id} className="thread-card">
              <button type="button" className="thread-card-head" onClick={() => void actions.openThread(root.id)}>
                {label(root.conversationId)}
                <span>
                  {root.thread.replyCount} {root.thread.replyCount === 1 ? "reply" : "replies"}
                </span>
              </button>
              <MessageItem message={root} context="list" />
              {replies.map((reply) => (
                <MessageItem key={reply.id} message={reply} context="list" />
              ))}
              <button type="button" className="button ghost" onClick={() => void actions.openThread(root.id)}>
                Открыть обсуждение
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function SavedView() {
  const { state } = useApp();
  const [saved, setSaved] = useState<Array<{ message: MessageDto; savedAt: string }> | null>(null);

  useEffect(() => {
    if (!state.workspaceId) return;
    api.activity
      .saved(state.workspaceId)
      .then(({ saved: list }) => setSaved(list))
      .catch(() => setSaved([]));
  }, [state.workspaceId]);

  return (
    <section className="view">
      <ViewHeader title="На потом" subtitle="Сохранённые сообщения" />
      <div className="view-scroll">
        {!saved ? (
          <Spinner label="Загрузка сохранённых сообщений" />
        ) : saved.length === 0 ? (
          <EmptyState title="Пока ничего не сохранено" body="Нажмите на значок закладки у сообщения, чтобы сохранить его здесь." />
        ) : (
          saved.map(({ message, savedAt }) => (
            <div key={message.id} className="panel-card">
              <div className="panel-card-head">
                <Bookmark size={13} /> Сохранено {formatRelative(savedAt)}
              </div>
              <MessageItem message={message} context="list" />
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
  const [scheduled, setScheduled] = useState<ScheduledMessageDto[]>([]);
  const [reminders, setReminders] = useState<ReminderDto[]>([]);

  const load = () => {
    if (!state.workspaceId) return;
    void api.activity.drafts(state.workspaceId).then(({ drafts: list }) => setDrafts(list));
    void api.activity.scheduled(state.workspaceId).then(({ scheduled: list }) => setScheduled(list));
    void api.activity.reminders(state.workspaceId).then(({ reminders: list }) => setReminders(list));
  };

  useEffect(load, [state.workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="view">
      <ViewHeader title="Черновики и отправленные" subtitle="Черновики, запланированные сообщения и напоминания" />
      <div className="view-scroll">
        <h3 className="view-subhead">
          <PenSquare size={14} /> Черновики
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
                className="list-row"
                onClick={() => void actions.openConversation(draft.conversationId)}
              >
                <div className="list-row-head">
                  <strong>{label(draft.conversationId)}</strong>
                  <time>{formatRelative(draft.updatedAt)}</time>
                </div>
                <RichText text={draft.bodyText} />
              </button>
            ))
        )}

        <h3 className="view-subhead">
          <Clock size={14} /> Запланированные
        </h3>
        {scheduled.length === 0 ? (
          <p className="muted padded">Нет запланированных сообщений.</p>
        ) : (
          scheduled.map((entry) => (
            <div key={entry.id} className="list-row is-static">
              <div className="list-row-head">
                <strong>{label(entry.conversationId)}</strong>
                <time>Отправка: {compactTimestamp(entry.sendAt)}</time>
                <button
                  type="button"
                  className="icon-button"
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

        <h3 className="view-subhead">
          <Bell size={14} /> Напоминания
        </h3>
        {reminders.length === 0 ? (
          <p className="muted padded">Напоминаний нет.</p>
        ) : (
          reminders.map((reminder) => (
            <div key={reminder.id} className="list-row is-static">
              <div className="list-row-head">
                <strong>{reminder.text}</strong>
                <time>{compactTimestamp(reminder.remindAt)}</time>
                <button
                  type="button"
                  className="button ghost"
                  onClick={async () => {
                    await api.activity.completeReminder(reminder.id);
                    load();
                  }}
                >
                  Выполнено
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
  const [unreads, setUnreads] = useState<Array<{ conversationId: string; messages: MessageDto[] }> | null>(null);

  const load = () => {
    if (!state.workspaceId) return;
    api.activity
      .unreads(state.workspaceId)
      .then(({ unreads: list }) => setUnreads(list))
      .catch(() => setUnreads([]));
  };

  useEffect(load, [state.workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="view">
      <ViewHeader
        title="Все непрочитанные"
        subtitle="Все сообщения, которые вы ещё не прочитали"
        action={
          <button
            type="button"
            className="button ghost"
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
      <div className="view-scroll">
        {!unreads ? (
          <Spinner label="Загрузка непрочитанных сообщений" />
        ) : unreads.length === 0 ? (
          <EmptyState title="Вы are all caught up" body="Непрочитанных сообщений нет." />
        ) : (
          unreads.map((entry) => (
            <div key={entry.conversationId} className="unread-group">
              <button type="button" className="unread-group-head" onClick={() => void actions.openConversation(entry.conversationId)}>
                {label(entry.conversationId)}
                <span>{entry.messages.length} new</span>
              </button>
              {entry.messages.map((message) => (
                <MessageItem key={message.id} message={message} context="list" />
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
