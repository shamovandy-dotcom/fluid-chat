"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  Clock,
  Копировать,
  Download,
  Ссылка2,
  СообщениеSquare,
  ЕщёVertical,
  Pencil,
  Pin,
  PinOff,
  Share2,
  Smile,
  Trash2
} from "lucide-react";
import type { FileSummary, СообщениеDto } from "@/shared/types";
import { toMentionDisplay, toMentionWire } from "@/shared/mention-text";
import { api } from "../../api";
import { formatBytes, formatDateTime, formatRelative, formatTime } from "../../format";
import { useApp, useDirectory, useMentionDirectory } from "../../store";
import { Avatar, IconButton, MenuDivider, MenuItem, Popover } from "../ui/primitives";
import { ЭмодзиPicker } from "../ui/emoji-picker";
import { ImagePreview } from "./image-preview";
import { СообщениеДобавить реакциюions, QuickДобавить реакциюions } from "./reactions";
import { ЭмодзиValue, RichText } from "./rich-text";

export function СообщениеItem({
  message,
  grouped,
  context = "channel",
  highlight
}: {
  message: СообщениеDto;
  grouped?: boolean;
  context?: "channel" | "thread" | "list";
  highlight?: boolean;
}) {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const mentions = useMentionDirectory();
  const [localИзменитьing, setLocalИзменитьing] = useState(false);
  // Изменитьed text is held in display form, same as the composer.
  const [editText, setИзменитьText] = useState(() => toMentionDisplay(message.bodyText, mentions));
  const [previewFile, setPreviewFile] = useState<FileSummary | null>(null);
  // ↑ in the composer asks the store to edit the last message you sent.
  const editing = localИзменитьing || state.editingСообщениеId === message.id;
  const setИзменитьing = (value: boolean) => {
    setLocalИзменитьing(value);
    if (!value && state.editingСообщениеId === message.id) actions.setИзменитьingСообщение(null);
    if (value) setИзменитьText(toMentionDisplay(message.bodyText, mentions));
  };
  const sender = directory.get(message.senderId);
  const timeFormat = state.session?.preferences?.timeFormat ?? "12h";
  const isAuthor = message.senderId === state.session?.id;
  const role = state.bootstrap?.role;
  const canModerate = role === "owner" || role === "admin";
  const pending = (message.metadata as { pending?: boolean } | null)?.pending === true;
  const isMeСообщение = (message.metadata as { subtype?: string } | null)?.subtype === "me_message";
  const sharedId = (message.metadata as { sharedСообщениеId?: string } | null)?.sharedСообщениеId;

  useEffect(() => {
    if (state.editingСообщениеId === message.id) setИзменитьText(toMentionDisplay(message.bodyText, mentions));
    // Only reload when the store starts an edit. `mentions` changes identity on
    // every presence event, which must not discard what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.editingСообщениеId, message.id, message.bodyText]);

  if (message.type !== "user") {
    return (
      <div className="system-message" data-message-id={message.id}>
        <span className="system-dot" />
        <RichText text={message.bodyText} />
        <time dateTime={message.createdAt}>{formatTime(message.createdAt, timeFormat)}</time>
      </div>
    );
  }

  if (message.deletedAt) {
    return (
      <article className="message is-deleted" data-message-id={message.id}>
        <div className="message-gutter" />
        <div className="message-content">
          <p className="deleted-note">This message was deleted.</p>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`message ${grouped ? "is-grouped" : ""} ${highlight ? "is-highlight" : ""} ${pending ? "is-pending" : ""}`}
      data-message-id={message.id}
    >
      <div className="message-gutter">
        {grouped ? (
          <time className="hover-time" dateTime={message.createdAt}>
            {formatTime(message.createdAt, timeFormat)}
          </time>
        ) : (
          <button
            type="button"
            className="avatar-button"
            onClick={() => actions.setRightPanel({ kind: "profile", userId: message.senderId })}
            aria-label={`Open ${sender?.displayName ?? "profile"}`}
          >
            <Avatar user={sender} size={36} />
          </button>
        )}
      </div>

      <div className="message-content">
        {!grouped ? (
          <div className="message-head">
            <button
              type="button"
              className="sender-name"
              onClick={() => actions.setRightPanel({ kind: "profile", userId: message.senderId })}
            >
              {sender?.displayName ?? "Unknown"}
            </button>
            {sender?.isBot ? <span className="pill app-pill">APP</span> : null}
            {sender?.statusЭмодзи ? <ЭмодзиValue value={`:${sender.statusЭмодзи}:`} /> : null}
            <time dateTime={message.createdAt} title={formatDateTime(message.createdAt, timeFormat)}>
              {formatTime(message.createdAt, timeFormat)}
            </time>
            {message.editedAt ? <span className="edited">(edited)</span> : null}
            {message.pinned ? (
              <span className="pill">
                <Pin size={11} /> pinned
              </span>
            ) : null}
          </div>
        ) : null}

        {editing ? (
          <form
            className="edit-form"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const { message: updated } = await api.messages.update(message.id, toMentionWire(editText, mentions));
                actions.upsertСообщение(updated);
                setИзменитьing(false);
              } catch (error) {
                actions.fail(error);
              }
            }}
          >
            <textarea
              value={editText}
              onChange={(event) => setИзменитьText(event.target.value)}
              rows={Math.min(8, editText.split("\n").length + 1)}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Escape") setИзменитьing(false);
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="edit-actions">
              <button type="button" className="button ghost" onClick={() => setИзменитьing(false)}>
                Отмена
              </button>
              <button type="submit" className="button primary" disabled={!editText.trim()}>
                Сохранить changes
              </button>
            </div>
          </form>
        ) : (
          <div className={isMeСообщение ? "message-body is-action" : "message-body"}>
            <RichText text={message.bodyText} />
          </div>
        )}

        {sharedId ? <SharedСообщение messageId={sharedId} /> : null}

        {message.files.length > 0 ? (
          <div className="attachments">
            {message.files.map((file) =>
              file.mimeType.startsWith("image/") ? (
                <button
                  key={file.id}
                  type="button"
                  className="attachment-image"
                  aria-label={`Preview ${file.name}`}
                  onClick={() => setPreviewFile(file)}
                >
                  {/* Known dimensions keep the scroll position stable while images load. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt={file.name}
                    loading="lazy"
                    width={file.width ?? undefined}
                    height={file.height ?? undefined}
                  />
                </button>
              ) : (
                <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="attachment-file">
                  <Download size={16} />
                  <span>
                    <strong>{file.name}</strong>
                    <small>{formatBytes(file.size)}</small>
                  </span>
                </a>
              )
            )}
          </div>
        ) : null}

        {message.links.map((link) => (
          <a key={link.url} className="link-preview" href={link.url} target="_blank" rel="noopener noreferrer">
            {link.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.imageUrl} alt="" loading="lazy" />
            ) : null}
            <span>
              {link.siteName ? <small>{link.siteName}</small> : null}
              <strong>{link.title ?? link.url}</strong>
              {link.description ? <p>{link.description}</p> : null}
            </span>
          </a>
        ))}

        <СообщениеДобавить реакциюions message={message} />

        {context !== "thread" && message.thread.replyCount > 0 ? (
          <button type="button" className="thread-summary" onClick={() => void actions.openThread(message.id)}>
            <span className="thread-avatars">
              {message.thread.participantIds.slice(0, 4).map((id) => (
                <Avatar key={id} user={directory.get(id)} size={20} presence={false} />
              ))}
            </span>
            <span className="thread-count">
              {message.thread.replyCount} {message.thread.replyCount === 1 ? "reply" : "replies"}
            </span>
            {message.thread.lastОтветитьAt ? (
              <span className="thread-time">Last reply {formatRelative(message.thread.lastОтветитьAt)}</span>
            ) : null}
          </button>
        ) : null}
      </div>

      <div className="message-toolbar" role="toolbar" aria-label="Действия с сообщением">
        <QuickДобавить реакциюions message={message} />
        <Popover
          width={340}
          align="end"
          trigger={({ toggle, ref }) => (
            <button type="button" ref={ref} onClick={toggle} title="Добавить реакцию">
              <Smile size={16} />
            </button>
          )}
        >
          {(close) => <ЭмодзиPicker onPick={(value) => void actions.toggleДобавить реакциюion(message, value)} onЗакрыть={close} />}
        </Popover>

        {context !== "thread" ? (
          <button type="button" title="Ответить в обсуждении" onClick={() => void actions.openThread(message.id)}>
            <СообщениеSquare size={16} />
          </button>
        ) : null}

        <button type="button" title="Share message" onClick={() => actions.setModal({ kind: "share", messageId: message.id })}>
          <Share2 size={16} />
        </button>

        <button
          type="button"
          title={message.saved ? "Remove from saved" : "Сохранить на потом"}
          onClick={async () => {
            try {
              if (message.saved) await api.messages.unsave(message.id);
              else await api.messages.save(message.id);
              actions.upsertСообщение({ ...message, saved: !message.saved });
            } catch (error) {
              actions.fail(error);
            }
          }}
        >
          {message.saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </button>

        <Popover
          width={230}
          align="end"
          trigger={({ toggle, ref }) => (
            <button type="button" ref={ref} onClick={toggle} title="Другие действия">
              <ЕщёVertical size={16} />
            </button>
          )}
        >
          {(close) => (
            <div className="menu">
              {isAuthor ? (
                <MenuItem
                  onClick={() => {
                    setИзменитьing(true);
                    close();
                  }}
                >
                  <Pencil size={14} /> Изменить message
                </MenuItem>
              ) : null}
              <MenuItem
                onClick={async () => {
                  close();
                  try {
                    if (message.pinned) await api.messages.unpin(message.id);
                    else await api.messages.pin(message.id);
                    actions.upsertСообщение({ ...message, pinned: !message.pinned });
                    actions.toast(message.pinned ? "Сообщение unpinned" : "Сообщение закреплено в этой переписке");
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                {message.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                {message.pinned ? "Unpin from conversation" : "Закрепить в переписке"}
              </MenuItem>
              {message.thread.replyCount > 0 || context === "thread" ? (
                <MenuItem
                  onClick={async () => {
                    close();
                    const next = message.thread.following ? "muted" : "following";
                    try {
                      await api.messages.follow(message.id, next);
                      actions.upsertСообщение({
                        ...message,
                        thread: { ...message.thread, following: next === "following" }
                      });
                      actions.toast(next === "following" ? "Following this thread" : "Вы не будете получать уведомления об этом обсуждении");
                    } catch (error) {
                      actions.fail(error);
                    }
                  }}
                >
                  <Bell size={14} /> {message.thread.following ? "Не следить за обсуждением" : "Следить за обсуждением"}
                </MenuItem>
              ) : null}
              <div className="menu-submenu">
                <span className="menu-submenu-label">
                  <Clock size={14} /> Remind me
                </span>
                <div className="menu-submenu-options">
                  {(
                    [
                      ["in 20 minutes", "20 min"],
                      ["in 1 hour", "1 hour"],
                      ["in 3 hours", "3 hours"],
                      ["tomorrow at 9am", "Tomorrow"],
                      ["next week at 9am", "Next week"]
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={async () => {
                        close();
                        try {
                          const { reminder } = await api.messages.remind(message.id, value);
                          actions.toast(`Reminder set for ${new Date(reminder.remindAt).toLocaleString()}`, "success");
                        } catch (error) {
                          actions.fail(error);
                        }
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <MenuItem
                onClick={() => {
                  close();
                  void navigator.clipboard.writeText(message.bodyText);
                  actions.toast("Сообщение text copied", "success");
                }}
              >
                <Копировать size={14} /> Копировать text
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  const url = `${window.location.origin}/?conversation=${message.conversationId}&message=${message.id}`;
                  void navigator.clipboard.writeText(url);
                  actions.toast("Ссылка copied to clipboard", "success");
                }}
              >
                <Ссылка2 size={14} /> Копировать link
              </MenuItem>
              <MenuItem
                onClick={async () => {
                  close();
                  await api.conversations.markUnread(message.conversationId, message.id);
                  await actions.refreshConversations();
                  actions.toast("Marked unread from here");
                }}
              >
                <СообщениеSquare size={14} /> Mark unread from here
              </MenuItem>
              {isAuthor || canModerate ? (
                <>
                  <MenuDivider />
                  <MenuItem
                    danger
                    onClick={async () => {
                      close();
                      if (!window.confirm("Удалить this message? This cannot be undone.")) return;
                      try {
                        await api.messages.remove(message.id);
                      } catch (error) {
                        actions.fail(error);
                      }
                    }}
                  >
                    <Trash2 size={14} /> Удалить message
                  </MenuItem>
                </>
              ) : null}
            </div>
          )}
        </Popover>
      </div>
      {previewFile ? <ImagePreview file={previewFile} onЗакрыть={() => setPreviewFile(null)} /> : null}
    </article>
  );
}

function SharedСообщение({ messageId }: { messageId: string }) {
  const [message, setСообщение] = useState<СообщениеDto | null>(null);
  const directory = useDirectory();
  const { state } = useApp();
  const timeFormat = state.session?.preferences?.timeFormat ?? "12h";

  useEffect(() => {
    let cancelled = false;
    api.messages
      .thread(messageId)
      .then(({ messages }) => {
        if (!cancelled) setСообщение(messages.find((entry) => entry.id === messageId) ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const sender = useMemo(() => (message ? directory.get(message.senderId) : undefined), [directory, message]);
  if (!message) return <div className="quoted-message is-loading">Загрузка… shared message…</div>;

  return (
    <div className="quoted-message">
      <div className="quoted-head">
        <Avatar user={sender} size={20} presence={false} />
        <strong>{sender?.displayName ?? "Unknown"}</strong>
        <time>{formatDateTime(message.createdAt, timeFormat)}</time>
      </div>
      <RichText text={message.bodyText} />
    </div>
  );
}
