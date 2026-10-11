"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, СообщениеSquare, Pin, Trash2, X } from "lucide-react";
import type { FileSummary, СообщениеDto, PublicUser } from "@/shared/types";
import { api } from "../../api";
import { formatBytes, formatDateTime, formatRelative, localTimeIn } from "../../format";
import { conversationTitle, useApp, useDirectory } from "../../store";
import { Avatar, EmptyState, IconButton, Spinner } from "../ui/primitives";
import { Composer } from "../message/composer";
import { СообщениеItem } from "../message/message-item";
import { СообщениеStack, TypingIndicator } from "../message/message-list";

export function RightPanel() {
  const { state, actions } = useApp();
  const panel = state.rightPanel;
  if (!panel) return null;

  const close = () => actions.setRightPanel(null);

  return (
    <aside classИмя="right-panel" aria-label="Панель сведений">
      {panel.kind === "thread" ? <ОбсуждениеPanel key={panel.messageId} messageId={panel.messageId} onЗакрыть={close} /> : null}
      {panel.kind === "profile" ? <ПрофильPanel userId={panel.userId} onЗакрыть={close} /> : null}
      {panel.kind === "details" ? <СведенияPanel conversationId={panel.conversationId} onЗакрыть={close} /> : null}
      {panel.kind === "pins" ? <PinsPanel conversationId={panel.conversationId} onЗакрыть={close} /> : null}
      {panel.kind === "files" ? <ФайлыPanel conversationId={panel.conversationId} onЗакрыть={close} /> : null}
    </aside>
  );
}

function PanelHeader({
  title,
  subtitle,
  onЗакрыть,
  action
}: {
  title: string;
  subtitle?: string;
  onЗакрыть: () => void;
  action?: React.ReactNode;
}) {
  return (
    <header classИмя="panel-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div classИмя="panel-header-actions">
        {action}
        <IconButton label="Закрыть панель" onClick={onЗакрыть}>
          <X size={18} />
        </IconButton>
      </div>
    </header>
  );
}

function ОбсуждениеPanel({ messageId, onЗакрыть }: { messageId: string; onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const messages = state.threads[messageId];
  const root = messages?.[0];
  const conversation = state.bootstrap?.conversations.find((entry) => entry.id === root?.conversationId);

  useEffect(() => {
    if (!state.threads[messageId]) void actions.openОбсуждение(messageId);
  }, [messageId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PanelHeader
        title="Обсуждение"
        subtitle={conversation ? conversationTitle(conversation, directory, state.session?.id) : undefined}
        onЗакрыть={onЗакрыть}
        action={
          root ? (
            <button
              type="button"
              classИмя="button ghost small"
              onClick={async () => {
                const next = root.thread.following ? "muted" : "following";
                try {
                  await api.messages.follow(root.id, next);
                  actions.upsertСообщение({ ...root, thread: { ...root.thread, following: next === "following" } });
                } catch (error) {
                  actions.fail(error);
                }
              }}
            >
              {root.thread.following ? "Следитьing" : "Следить"}
            </button>
          ) : null
        }
      />
      <div classИмя="panel-scroll">
        {!messages ? (
          <Spinner label="Загрузка обсуждения" />
        ) : (
          <>
            <СообщениеItem message={messages[0]} context="thread" />
            {messages.length > 1 ? (
              <div classИмя="thread-divider">
                {messages.length - 1} {messages.length === 2 ? "reply" : "replies"}
              </div>
            ) : null}
            <СообщениеStack messages={messages.slice(1)} context="thread" />
          </>
        )}
      </div>
      {root ? <TypingIndicator conversationId={root.conversationId} parentСообщениеId={root.id} /> : null}
      {root && conversation ? (
        <Composer
          conversationId={root.conversationId}
          parentСообщениеId={root.id}
          placeholder="Ответить…"
          autoFocus
          onSent={() => void actions.openОбсуждение(messageId)}
        />
      ) : null}
    </>
  );
}

function ПрофильPanel({ userId, onЗакрыть }: { userId: string; onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const [user, setUser] = useState<PublicUser | undefined>(directory.get(userId));
  const timeFormat = state.session?.preferences?.timeFormat ?? "12h";
  const isSelf = state.session?.id === userId;

  useEffect(() => {
    if (!directory.get(userId)) {
      api.users
        .profile(userId)
        .then(({ user: fetched }) => setUser(fetched))
        .catch(() => undefined);
    } else {
      setUser(directory.get(userId));
    }
  }, [userId, directory]);

  if (!user) return <PanelHeader title="Профиль" onЗакрыть={onЗакрыть} />;

  const localTime = localTimeIn(user.timezone, timeFormat);

  return (
    <>
      <PanelHeader title="Профиль" onЗакрыть={onЗакрыть} />
      <div classИмя="panel-scroll profile-panel">
        <div classИмя="profile-avatar">
          <Avatar user={user} size={160} presence={false} />
        </div>
        <h3>{user.displayИмя}</h3>
        {user.handle ? <p classИмя="muted">@{user.handle}</p> : null}
        {user.title ? <p classИмя="profile-title">{user.title}</p> : null}
        {user.statusText ? (
          <p classИмя="profile-status">
            {user.statusЭмодзи ? <span aria-hidden>:{user.statusЭмодзи}:</span> : null} {user.statusText}
          </p>
        ) : null}
        <dl classИмя="profile-facts">
          {user.pronouns ? (
            <>
              <dt>Pronouns</dt>
              <dd>{user.pronouns}</dd>
            </>
          ) : null}
          <dt>Электронная почта</dt>
          <dd>
            <a href={`mailto:${user.email}`}>{user.email}</a>
          </dd>
          {localTime ? (
            <>
              <dt>Local time</dt>
              <dd>{localTime}</dd>
            </>
          ) : null}
          <dt>Presence</dt>
          <dd classИмя="capitalize">{user.presence}</dd>
        </dl>
        <div classИмя="profile-actions">
          {isSelf ? (
            <button type="button" classИмя="button primary" onClick={() => actions.setModal({ kind: "profile-editor" })}>
              Изменить profile
            </button>
          ) : (
            <button
              type="button"
              classИмя="button primary"
              onClick={async () => {
                if (!state.workspaceId) return;
                try {
                  const { conversation } = await api.conversations.openDm(state.workspaceId, [userId]);
                  await actions.refreshBootstrap();
                  await actions.openConversation(conversation.id);
                } catch (error) {
                  actions.fail(error);
                }
              }}
            >
              <СообщениеSquare size={15} /> Сообщение
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function СведенияPanel({ conversationId, onЗакрыть }: { conversationId: string; onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const conversation = state.bootstrap?.conversations.find((entry) => entry.id === conversationId);
  const channel = conversation?.channel;
  const [tab, setTab] = useState<"about" | "members" | "settings">("about");
  const [topic, setТема] = useState(channel?.topic ?? "");
  const [description, setОписание] = useState(channel?.description ?? "");
  const isAdmin = state.bootstrap?.role === "owner" || state.bootstrap?.role === "admin";

  useEffect(() => {
    setТема(channel?.topic ?? "");
    setОписание(channel?.description ?? "");
  }, [channel?.id, channel?.topic, channel?.description]);

  if (!conversation) return <PanelHeader title="Сведения" onЗакрыть={onЗакрыть} />;

  return (
    <>
      <PanelHeader
        title={conversationTitle(conversation, directory, state.session?.id)}
        subtitle={channel ? `${conversation.memberIds.length} members` : "Личное сообщение"}
        onЗакрыть={onЗакрыть}
      />
      <div classИмя="panel-tabs" role="tablist">
        {(["about", "members", ...(channel ? (["settings"] as const) : [])] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            classИмя={tab === entry ? "is-active" : ""}
            onClick={() => setTab(entry)}
          >
            {entry === "about" ? "About" : entry === "members" ? "Участники" : "Настройки"}
          </button>
        ))}
      </div>

      <div classИмя="panel-scroll">
        {tab === "about" ? (
          channel ? (
            <div classИмя="panel-section">
              <label classИмя="field">
                Тема
                <input
                  value={topic}
                  onChange={(event) => setТема(event.target.value)}
                  onBlur={async () => {
                    if (topic === (channel.topic ?? "")) return;
                    try {
                      await api.channels.update(channel.id, { topic: topic || null });
                      await actions.refreshBootstrap();
                    } catch (error) {
                      actions.fail(error);
                    }
                  }}
                  placeholder="Добавить тему"
                />
              </label>
              <label classИмя="field">
                Описание
                <textarea
                  value={description}
                  onChange={(event) => setОписание(event.target.value)}
                  onBlur={async () => {
                    if (description === (channel.description ?? "")) return;
                    try {
                      await api.channels.update(channel.id, { description: description || null });
                      await actions.refreshBootstrap();
                    } catch (error) {
                      actions.fail(error);
                    }
                  }}
                  rows={4}
                  placeholder="О чём этот канал?"
                />
              </label>
              <p classИмя="muted">
                Создатьd {formatDateTime(channel.createdAt)} by {directory.get(channel.createdByUserId)?.displayИмя ?? "someone"}
              </p>
            </div>
          ) : (
            <div classИмя="panel-section">
              <p classИмя="muted">Личные сообщения are private to their participants.</p>
            </div>
          )
        ) : null}

        {tab === "members" ? (
          <div classИмя="panel-section member-list">
            {conversation.memberIds.map((id) => {
              const member = directory.get(id);
              return (
                <div key={id} classИмя="member-row">
                  <button type="button" onClick={() => actions.setRightPanel({ kind: "profile", userId: id })}>
                    <Avatar user={member} size={30} />
                    <span>
                      <strong>{member?.displayИмя ?? "Unknown"}</strong>
                      {member?.title ? <small>{member.title}</small> : null}
                    </span>
                  </button>
                  {channel && isAdmin && id !== state.session?.id ? (
                    <IconButton
                      label={`Удалить ${member?.displayИмя ?? "member"}`}
                      onClick={async () => {
                        try {
                          await api.channels.removeMember(channel.id, id);
                          await actions.refreshBootstrap();
                        } catch (error) {
                          actions.fail(error);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  ) : null}
                </div>
              );
            })}
            {channel ? (
              <button
                type="button"
                classИмя="button ghost"
                onClick={() => actions.setModal({ kind: "add-people", conversationId })}
              >
                Добавить участников
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === "settings" && channel ? (
          <div classИмя="panel-section">
            {isAdmin || channel.createdByUserId === state.session?.id ? (
              <form
                classИмя="field"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const name = new FormData(event.currentTarget).get("name");
                  try {
                    await api.channels.update(channel.id, { name: String(name) });
                    await actions.refreshBootstrap();
                    actions.toast("Channel renamed", "success");
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                Название канала
                <div classИмя="inline-field">
                  <input name="name" defaultValue={channel.name} maxLength={80} />
                  <button type="submit" classИмя="button ghost">
                    Rename
                  </button>
                </div>
              </form>
            ) : null}

            <label classИмя="field">
              Уведомления
              <select
                value={conversation.membership?.notificationLevel ?? "all"}
                onChange={async (event) => {
                  await api.conversations.updateУчастникиhip(conversationId, {
                    notificationLevel: event.target.value as "all" | "mentions" | "none"
                  });
                  await actions.refreshConversations();
                }}
              >
                <option value="all">Every new message</option>
                <option value="mentions">Mentions only</option>
                <option value="none">Nothing</option>
              </select>
            </label>

            {isAdmin ? (
              <>
                <label classИмя="field">
                  Who can post
                  <select
                    value={channel.postingPolicy}
                    onChange={async (event) => {
                      await api.channels.update(channel.id, { postingPolicy: event.target.value });
                      await actions.refreshBootstrap();
                    }}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="admins">Admins only</option>
                  </select>
                </label>

                <label classИмя="checkbox-field">
                  <input
                    type="checkbox"
                    checked={channel.autoJoin}
                    disabled={channel.visibility === "private"}
                    onChange={async (event) => {
                      try {
                        await api.channels.update(channel.id, { autoJoin: event.target.checked });
                        await actions.refreshBootstrap();
                      } catch (error) {
                        actions.fail(error);
                      }
                    }}
                  />
                  <span>
                    <strong>Add new members automatically</strong>
                    <small>Everyone who joins the workspace lands in this channel.</small>
                  </span>
                </label>

                <label classИмя="field">
                  Keep messages for
                  <select
                    value={channel.retentionDays ?? ""}
                    onChange={async (event) => {
                      const value = event.target.value;
                      try {
                        await api.channels.update(channel.id, {
                          retentionDays: value === "" ? null : Number(value)
                        });
                        await actions.refreshBootstrap();
                        actions.toast("Retention updated", "success");
                      } catch (error) {
                        actions.fail(error);
                      }
                    }}
                  >
                    <option value="">Forever (workspace default)</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </label>

                <WebhookНастройки channelId={channel.id} />
              </>
            ) : null}

            {isAdmin && channel.visibility === "public" ? (
              <button
                type="button"
                classИмя="button ghost"
                onClick={async () => {
                  if (!window.confirm(`Make #${channel.name} private? This cannot be undone.`)) return;
                  try {
                    await api.channels.update(channel.id, { visibility: "private" });
                    await actions.refreshBootstrap();
                    actions.toast("Channel is now private", "success");
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                Change to a private channel
              </button>
            ) : null}

            <div classИмя="panel-danger">
              <button
                type="button"
                classИмя="button ghost"
                onClick={async () => {
                  try {
                    await api.channels.leave(channel.id);
                    await actions.refreshBootstrap();
                    onЗакрыть();
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                Leave channel
              </button>
              {isAdmin && channel.name !== "general" ? (
                <button
                  type="button"
                  classИмя="button danger"
                  onClick={async () => {
                    if (!window.confirm(`Archive #${channel.name}?`)) return;
                    try {
                      await api.channels.archive(channel.id);
                      await actions.refreshBootstrap();
                      onЗакрыть();
                    } catch (error) {
                      actions.fail(error);
                    }
                  }}
                >
                  Archive channel
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Incoming webhooks for a channel: create, copy once, revoke. */
function WebhookНастройки({ channelId }: { channelId: string }) {
  const { actions } = useApp();
  const [hooks, setHooks] = useState<Array<{ id: string; name: string; lastUsedAt: string | null }>>([]);
  const [name, setИмя] = useState("");
  const [freshUrl, setFreshUrl] = useState<string | null>(null);

  const load = useCallback(() => {
    api.channels
      .webhooks(channelId)
      .then(({ webhooks }) => setHooks(webhooks))
      .catch(() => setHooks([]));
  }, [channelId]);

  useEffect(load, [load]);

  return (
    <div classИмя="field">
      Incoming webhooks
      <p classИмя="muted small">Let a build, alert or script post here without a user account.</p>
      <div classИмя="inline-field">
        <input value={name} onChange={(event) => setИмя(event.target.value)} placeholder="Deploy bot" maxLength={60} />
        <button
          type="button"
          classИмя="button ghost"
          disabled={!name.trim()}
          onClick={async () => {
            try {
              const { url } = await api.channels.createWebhook(channelId, name.trim());
              setFreshUrl(url);
              setИмя("");
              load();
            } catch (error) {
              actions.fail(error);
            }
          }}
        >
          Создать
        </button>
      </div>

      {freshUrl ? (
        <div classИмя="copy-row">
          <code>{freshUrl}</code>
          <button
            type="button"
            classИмя="button ghost"
            onClick={() => {
              void navigator.clipboard.writeText(freshUrl);
              actions.toast("Webhook URL copied — it is not shown again", "success");
            }}
          >
            Копировать
          </button>
        </div>
      ) : null}

      <div classИмя="webhook-list">
        {hooks.map((hook) => (
          <div key={hook.id} classИмя="webhook-row">
            <span>
              <strong>{hook.name}</strong>
              <small>{hook.lastUsedAt ? `last used ${formatRelative(hook.lastUsedAt)}` : "never used"}</small>
            </span>
            <button
              type="button"
              classИмя="button ghost"
              onClick={async () => {
                if (!window.confirm(`Revoke ${hook.name}?`)) return;
                await api.channels.deleteWebhook(hook.id);
                load();
              }}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PinsPanel({ conversationId, onЗакрыть }: { conversationId: string; onЗакрыть: () => void }) {
  const [pins, setPins] = useState<Array<{ message: СообщениеDto; pinnedAt: string }> | null>(null);

  useEffect(() => {
    api.conversations
      .pins(conversationId)
      .then(({ pins: list }) => setPins(list))
      .catch(() => setPins([]));
  }, [conversationId]);

  return (
    <>
      <PanelHeader title="Закреплено" subtitle="Сообщения, закреплённые в этой переписке" onЗакрыть={onЗакрыть} />
      <div classИмя="panel-scroll">
        {!pins ? (
          <Spinner label="Загрузка закреплённых сообщений" />
        ) : pins.length === 0 ? (
          <EmptyState title="Пока ничего не закреплено" body="Закрепляйте важные сообщения через меню ⋯." />
        ) : (
          pins.map(({ message }) => (
            <div key={message.id} classИмя="panel-card">
              <div classИмя="panel-card-head">
                <Pin size={13} /> Закреплено
              </div>
              <СообщениеItem message={message} context="list" />
            </div>
          ))
        )}
      </div>
    </>
  );
}

function ФайлыPanel({ conversationId, onЗакрыть }: { conversationId: string; onЗакрыть: () => void }) {
  const [files, setФайлы] = useState<FileSummary[] | null>(null);

  useEffect(() => {
    api.conversations
      .files(conversationId)
      .then(({ files: list }) => setФайлы(list))
      .catch(() => setФайлы([]));
  }, [conversationId]);

  return (
    <>
      <PanelHeader title="Файлы" subtitle="Все файлы, которыми поделились здесь" onЗакрыть={onЗакрыть} />
      <div classИмя="panel-scroll">
        {!files ? (
          <Spinner label="Загрузка файлов" />
        ) : files.length === 0 ? (
          <EmptyState title="Пока нет файлов" body="Перетащите файл в поле сообщения, чтобы поделиться им." />
        ) : (
          <div classИмя="file-grid">
            {files.map((file) => (
              <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" classИмя="file-card">
                {file.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt="" loading="lazy" />
                ) : (
                  <Download size={18} />
                )}
                <span>
                  <strong>{file.name}</strong>
                  <small>{formatBytes(file.size)}</small>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
