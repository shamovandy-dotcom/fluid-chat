"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  BellВыкл.,
  CalendarDays,
  FileText,
  Hash,
  Info,
  Lock,
  Pin,
  Plus,
  Star,
  UserPlus,
  Users
} from "lucide-react";
import type { BookmarkDto } from "@/shared/types";
import { api } from "../../api";
import { conversationTitle, useApp, useDirectory } from "../../store";
import { Avatar, IconButton, MenuDivider, MenuItem, Popover } from "../ui/primitives";
import { Composer } from "../message/composer";
import { СообщениеList } from "../message/message-list";

export function ConversationView({ conversationId }: { conversationId: string }) {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const conversation = state.bootstrap?.conversations.find((entry) => entry.id === conversationId);
  const channel = conversation?.channel;
  const [bookmarks, setBookmarks] = useState<BookmarkDto[]>([]);
  const title = conversationTitle(conversation ?? null, directory, state.session?.id);
  const joined = conversation?.membership?.joined ?? false;
  const dmPartnerId =
    conversation?.type === "dm" ? conversation.memberIds.find((id) => id !== state.session?.id) : undefined;

  useEffect(() => {
    if (!channel) {
      setBookmarks([]);
      return;
    }
    api.channels
      .bookmarks(channel.id)
      .then(({ bookmarks: list }) => setBookmarks(list))
      .catch(() => setBookmarks([]));
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!conversation) {
    return (
      <section classИмя="conversation">
        <div classИмя="conversation-empty">This conversation is no longer available.</div>
      </section>
    );
  }

  const memberAvatars = conversation.memberIds.slice(0, 4);

  return (
    <section classИмя="conversation">
      <header classИмя="conversation-header">
        <div classИмя="conversation-title">
          <h1>
            {channel ? (
              channel.visibility === "private" ? (
                <Lock size={16} />
              ) : (
                <Hash size={18} />
              )
            ) : dmPartnerId ? (
              <Avatar user={directory.get(dmPartnerId)} size={22} />
            ) : (
              <Users size={16} />
            )}
            {title}
          </h1>
          <button
            type="button"
            classИмя={`star-toggle ${conversation.membership?.starred ? "is-on" : ""}`}
            aria-label={conversation.membership?.starred ? "Unstar conversation" : "Добавить в избранное"}
            onClick={async () => {
              await api.conversations.updateУчастникиhip(conversationId, { starred: !conversation.membership?.starred });
              await actions.refreshConversations();
            }}
          >
            <Star size={14} />
          </button>
          {channel?.topic ? (
            <button
              type="button"
              classИмя="conversation-topic"
              onClick={() => actions.setRightPanel({ kind: "details", conversationId })}
            >
              {channel.topic}
            </button>
          ) : channel ? (
            <button
              type="button"
              classИмя="conversation-topic is-empty"
              onClick={() => actions.setRightPanel({ kind: "details", conversationId })}
            >
              Добавить тему
            </button>
          ) : null}
        </div>

        <div classИмя="conversation-actions">
          <button
            type="button"
            classИмя="member-facepile"
            onClick={() => actions.setRightPanel({ kind: "details", conversationId })}
            aria-label={`${conversation.memberIds.length} members`}
          >
            {memberAvatars.map((id) => (
              <Avatar key={id} user={directory.get(id)} size={22} presence={false} />
            ))}
            <span>{conversation.memberIds.length}</span>
          </button>

          <label classИмя="jump-date" title="Перейти к дате">
            <CalendarDays size={17} />
            <span classИмя="sr-only">Перейти к дате</span>
            <input
              type="date"
              onChange={(event) => {
                if (event.target.value) void actions.jumpToDate(conversationId, event.target.value);
              }}
            />
          </label>

          <IconButton label="Закреплено messages" onClick={() => actions.setRightPanel({ kind: "pins", conversationId })}>
            <Pin size={17} />
          </IconButton>
          <IconButton label="Файлы" onClick={() => actions.setRightPanel({ kind: "files", conversationId })}>
            <FileText size={17} />
          </IconButton>
          <IconButton
            label={conversation.membership?.muted ? "Unmute conversation" : "Отключить уведомления"}
            onClick={async () => {
              await api.conversations.updateУчастникиhip(conversationId, { muted: !conversation.membership?.muted });
              await actions.refreshConversations();
            }}
          >
            {conversation.membership?.muted ? <BellВыкл. size={17} /> : <Bell size={17} />}
          </IconButton>
          {channel ? (
            <IconButton label="Добавить участников" onClick={() => actions.setModal({ kind: "add-people", conversationId })}>
              <UserPlus size={17} />
            </IconButton>
          ) : null}
          <IconButton label="Сведения о переписке" onClick={() => actions.setRightPanel({ kind: "details", conversationId })}>
            <Info size={17} />
          </IconButton>
        </div>
      </header>

      {channel ? (
        <div classИмя="bookmark-bar">
          {bookmarks.map((bookmark) => (
            <a key={bookmark.id} href={bookmark.url} target="_blank" rel="noopener noreferrer" classИмя="bookmark">
              {bookmark.emoji ? <span aria-hidden>{bookmark.emoji}</span> : null}
              {bookmark.title}
            </a>
          ))}
          <Popover
            width={320}
            trigger={({ toggle, ref }) => (
              <button type="button" classИмя="bookmark add" ref={ref} onClick={toggle}>
                <Plus size={13} /> Add a bookmark
              </button>
            )}
          >
            {(close) => (
              <form
                classИмя="stack-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  try {
                    const { bookmark } = await api.channels.addBookmark(channel.id, {
                      title: String(form.get("title")),
                      url: String(form.get("url"))
                    });
                    setBookmarks((current) => [...current, bookmark]);
                    close();
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                <label>
                  Title
                  <input name="title" required maxLength={120} placeholder="Инструкция" />
                </label>
                <label>
                  Ссылка
                  <input name="url" type="url" required placeholder="https://" />
                </label>
                <button classИмя="button primary" type="submit">
                  Add bookmark
                </button>
              </form>
            )}
          </Popover>
        </div>
      ) : null}

      <СообщениеList conversationId={conversationId} />

      {channel?.archivedAt ? (
        <div classИмя="composer-locked">
          This channel is archived. It is read-only.
          {state.bootstrap?.role !== "member" ? (
            <button
              type="button"
              classИмя="button ghost"
              onClick={async () => {
                await api.channels.unarchive(channel.id);
                await actions.refreshBootstrap();
              }}
            >
              Unarchive
            </button>
          ) : null}
        </div>
      ) : !joined && channel ? (
        <div classИмя="composer-locked">
          Вы are previewing #{channel.name}.
          <button
            type="button"
            classИмя="button primary"
            onClick={async () => {
              try {
                await api.channels.join(channel.id);
                await actions.refreshBootstrap();
                await actions.openConversation(conversationId);
              } catch (error) {
                actions.fail(error);
              }
            }}
          >
            Join channel
          </button>
        </div>
      ) : (
        <Composer
          conversationId={conversationId}
          placeholder={channel ? `Сообщение #${channel.name}` : `Сообщение ${title}`}
        />
      )}
    </section>
  );
}

export function ConversationMenuItems({ conversationId }: { conversationId: string }) {
  const { state, actions } = useApp();
  const conversation = state.bootstrap?.conversations.find((entry) => entry.id === conversationId);
  if (!conversation) return null;
  return (
    <>
      <MenuItem onClick={() => actions.setRightPanel({ kind: "details", conversationId })}>Open details</MenuItem>
      <MenuDivider />
      <MenuItem
        onClick={async () => {
          await api.conversations.updateУчастникиhip(conversationId, {
            notificationLevel: conversation.membership?.notificationLevel === "all" ? "mentions" : "all"
          });
          await actions.refreshConversations();
        }}
      >
        Notify me about {conversation.membership?.notificationLevel === "all" ? "mentions only" : "every message"}
      </MenuItem>
    </>
  );
}
