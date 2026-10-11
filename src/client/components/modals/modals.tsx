"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Копировать, Hash, Lock } from "lucide-react";
import { api } from "../../api";
import { track } from "../../analytics";
import { EMOJI_CATEGORIES } from "../../emoji";
import { conversationTitle, useApp, useDirectory } from "../../store";
import { Avatar, Modal } from "../ui/primitives";
import { RichText } from "../message/rich-text";

/* -------------------------------------------------------------------------- */
/* Пригласить                                                                      */
/* -------------------------------------------------------------------------- */

export function ПригласитьModal({ onЗакрыть }: { onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const [emails, setЭлектронная почтаs] = useState("");
  const [role, setRole] = useState<"member" | "admin" | "guest">("member");
  const [inviteLink, setПригласитьLink] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  return (
    <Modal
      title={`Пригласить участников to ${state.bootstrap?.workspace.name ?? "workspace"}`}
      onЗакрыть={onЗакрыть}
      footer={
        <button type="button" classИмя="button ghost" onClick={onЗакрыть}>
          Готово
        </button>
      }
    >
      <form
        classИмя="stack-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!state.workspaceId) return;
          const list = emails
            .split(/[\s,;]+/)
            .map((value) => value.trim())
            .filter(Boolean);
          if (list.length === 0) return;
          try {
            const { invites, skipped } = await api.invites.send(state.workspaceId, list, role);
            track("invites_sent", { count: invites.length, skipped_count: skipped.length, role });
            setSent(invites.map((invite) => invite.inviteUrl));
            setЭлектронная почтаs("");
            actions.toast(
              `${invites.length} invite${invites.length === 1 ? "" : "s"} sent${skipped.length ? `, ${skipped.length} already pending` : ""}`,
              "success"
            );
          } catch (error) {
            actions.fail(error);
          }
        }}
      >
        <label classИмя="field">
          Электронная почта addresses
          <textarea
            value={emails}
            onChange={(event) => setЭлектронная почтаs(event.target.value)}
            rows={3}
            placeholder="ada@example.com, grace@example.com"
          />
        </label>
        <label classИмя="field">
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="member">Member — full access to public channels</option>
            <option value="admin">Admin — can manage members and channels</option>
            <option value="guest">Guest — only the channels you add them to</option>
          </select>
        </label>
        <button type="submit" classИмя="button primary">
          Отправить invitations
        </button>
      </form>

      {sent.length > 0 ? (
        <div classИмя="invite-links">
          <h4>Invitation links</h4>
          {sent.map((link) => (
            <code key={link}>{link}</code>
          ))}
        </div>
      ) : null}

      <div classИмя="modal-section">
        <h4>Share an invite link</h4>
        <p classИмя="muted">Anyone with the link can join as a member. The link expires in 30 days.</p>
        {inviteLink ? (
          <div classИмя="copy-row">
            <code>{inviteLink}</code>
            <button
              type="button"
              classИмя="button ghost"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={14} /> : <Копировать size={14} />} {copied ? "Copied" : "Копировать"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            classИмя="button ghost"
            onClick={async () => {
              if (!state.workspaceId) return;
              try {
                const { inviteUrl } = await api.invites.createLink(state.workspaceId, { expiresInDays: 30 });
                track("invite_link_created", {});
                setПригласитьLink(inviteUrl);
              } catch (error) {
                actions.fail(error);
              }
            }}
          >
            Создать invite link
          </button>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Новый канал                                                                 */
/* -------------------------------------------------------------------------- */

export function NewChannelModal({ onЗакрыть }: { onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const [name, setИмя] = useState("");
  const [description, setОписание] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Создать a channel" onЗакрыть={onЗакрыть}>
      <form
        classИмя="stack-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!state.workspaceId || busy) return;
          setBusy(true);
          try {
            const { conversationId } = await api.channels.create(state.workspaceId, {
              name,
              visibility,
              description: description || undefined
            });
            track("channel_created", { visibility, has_description: description.trim().length > 0 });
            await actions.refreshBootstrap();
            await actions.openConversation(conversationId);
            onЗакрыть();
          } catch (error) {
            actions.fail(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label classИмя="field">
          Имя
          <div classИмя="prefixed-input">
            <span>{visibility === "private" ? <Lock size={14} /> : <Hash size={15} />}</span>
            <input
              value={name}
              onChange={(event) => setИмя(event.target.value)}
              placeholder="plan-budget"
              required
              maxLength={80}
              autoFocus
            />
          </div>
        </label>
        <label classИмя="field">
          Описание <span classИмя="optional">(optional)</span>
          <input
            value={description}
            onChange={(event) => setОписание(event.target.value)}
            placeholder="О чём этот канал?"
            maxLength={500}
          />
        </label>
        <label classИмя="checkbox-field">
          <input
            type="checkbox"
            checked={visibility === "private"}
            onChange={(event) => setVisibility(event.target.checked ? "private" : "public")}
          />
          <span>
            <strong>Make private</strong>
            <small>Вкл.ly invited people can see this channel.</small>
          </span>
        </label>
        <button type="submit" classИмя="button primary" disabled={!name.trim() || busy}>
          Создать channel
        </button>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* New direct message                                                          */
/* -------------------------------------------------------------------------- */

export function NewDmModal({ onЗакрыть }: { onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const members = (state.bootstrap?.members ?? []).filter((member) => member.user.id !== state.session?.id);
  const visible = members.filter((member) =>
    `${member.user.displayИмя} ${member.user.handle ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <Modal
      title="Новое сообщение"
      onЗакрыть={onЗакрыть}
      footer={
        <button
          type="button"
          classИмя="button primary"
          disabled={selected.length === 0}
          onClick={async () => {
            if (!state.workspaceId) return;
            try {
              const { conversation } = await api.conversations.openDm(state.workspaceId, selected);
              track("dm_started", { participant_count: selected.length });
              await actions.refreshBootstrap();
              await actions.openConversation(conversation.id);
              onЗакрыть();
            } catch (error) {
              actions.fail(error);
            }
          }}
        >
          Start conversation
        </button>
      }
    >
      <div classИмя="chips">
        {selected.map((id) => {
          const member = members.find((entry) => entry.user.id === id);
          return (
            <button key={id} type="button" classИмя="chip" onClick={() => setSelected((current) => current.filter((entry) => entry !== id))}>
              {member?.user.displayИмя} ✕
            </button>
          );
        })}
      </div>
      <input
        classИмя="modal-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск people"
        autoFocus
      />
      <div classИмя="picker-list">
        {visible.map((member) => (
          <button
            key={member.user.id}
            type="button"
            classИмя={selected.includes(member.user.id) ? "is-selected" : ""}
            onClick={() =>
              setSelected((current) =>
                current.includes(member.user.id)
                  ? current.filter((entry) => entry !== member.user.id)
                  : [...current, member.user.id]
              )
            }
          >
            <Avatar user={member.user} size={28} />
            <span>
              <strong>{member.user.displayИмя}</strong>
              <small>{member.user.title ?? member.user.email}</small>
            </span>
          </button>
        ))}
        {visible.length === 0 ? (
          <div classИмя="empty-state">
            <strong>{query.trim() ? "Участники не найдены" : "В этом рабочем пространстве пока нет других участников"}</strong>
            <p classИмя="muted">
              Личное сообщениеs are available to people in this workspace. Пригласить another account to join this workspace first.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Add people to a channel                                                     */
/* -------------------------------------------------------------------------- */

export function AddЛюдиModal({ conversationId, onЗакрыть }: { conversationId: string; onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const conversation = state.bootstrap?.conversations.find((entry) => entry.id === conversationId);
  const channel = conversation?.channel;

  const candidates = (state.bootstrap?.members ?? []).filter(
    (member) => !conversation?.memberIds.includes(member.user.id)
  );
  const visible = candidates.filter((member) =>
    `${member.user.displayИмя} ${member.user.handle ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <Modal
      title={channel ? `Add people to #${channel.name}` : "Add people"}
      onЗакрыть={onЗакрыть}
      footer={
        <button
          type="button"
          classИмя="button primary"
          disabled={selected.length === 0 || !channel}
          onClick={async () => {
            if (!channel) return;
            try {
              await api.channels.addУчастники(channel.id, selected);
              await actions.refreshBootstrap();
              actions.toast(`Added ${selected.length} ${selected.length === 1 ? "person" : "people"}`, "success");
              onЗакрыть();
            } catch (error) {
              actions.fail(error);
            }
          }}
        >
          Add
        </button>
      }
    >
      {!channel ? (
        <p classИмя="muted">You can only add people to channels. Start a new group message instead.</p>
      ) : (
        <>
          <div classИмя="chips">
            {selected.map((id) => {
              const member = candidates.find((entry) => entry.user.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  classИмя="chip"
                  onClick={() => setSelected((current) => current.filter((entry) => entry !== id))}
                >
                  {member?.user.displayИмя} ✕
                </button>
              );
            })}
          </div>
          <input
            classИмя="modal-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск people"
            autoFocus
          />
          <div classИмя="picker-list">
            {visible.map((member) => (
              <button
                key={member.user.id}
                type="button"
                classИмя={selected.includes(member.user.id) ? "is-selected" : ""}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(member.user.id)
                      ? current.filter((entry) => entry !== member.user.id)
                      : [...current, member.user.id]
                  )
                }
              >
                <Avatar user={member.user} size={28} />
                <span>
                  <strong>{member.user.displayИмя}</strong>
                  <small>{member.user.title ?? member.user.email}</small>
                </span>
              </button>
            ))}
            {visible.length === 0 ? <p classИмя="muted">Everyone in the workspace is already here.</p> : null}
          </div>
        </>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Статус                                                                      */
/* -------------------------------------------------------------------------- */

const STATUS_PRESETS = [
  { emoji: "calendar", text: "In a meeting", minutes: 60 },
  { emoji: "bus", text: "Commuting", minutes: 30 },
  { emoji: "face_with_thermometer", text: "Out sick", minutes: 60 * 24 },
  { emoji: "beach_umbrella", text: "Vacationing", minutes: 60 * 24 * 7 },
  { emoji: "house", text: "Working remotely", minutes: 60 * 8 }
];

export function СтатусModal({ onЗакрыть }: { onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const [emoji, setEmoji] = useState(state.session?.statusEmoji ?? "speech_balloon");
  const [text, setText] = useState(state.session?.statusText ?? "");
  const [minutes, setMinutes] = useState<number | null>(null);

  const emojiOptions = useMemo(
    () => EMOJI_CATEGORIES.flatMap((category) => category.emoji.slice(0, 12).map(([name, char]) => ({ name, char }))),
    []
  );

  return (
    <Modal
      title="Set a status"
      onЗакрыть={onЗакрыть}
      footer={
        <>
          <button
            type="button"
            classИмя="button ghost"
            onClick={async () => {
              await actions.setСтатус({ emoji: null, text: null, expiresAt: null });
              onЗакрыть();
            }}
          >
            Очистить status
          </button>
          <button
            type="button"
            classИмя="button primary"
            onClick={async () => {
              await actions.setСтатус({
                emoji,
                text: text || null,
                expiresAt: minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null
              });
              onЗакрыть();
            }}
          >
            Сохранить
          </button>
        </>
      }
    >
      <div classИмя="status-row">
        <select value={emoji} onChange={(event) => setEmoji(event.target.value)} aria-label="Статус emoji">
          {emojiOptions.map((option) => (
            <option key={option.name} value={option.name}>
              {option.char} :{option.name}:
            </option>
          ))}
        </select>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="What is happening?" maxLength={140} />
      </div>

      <label classИмя="field">
        Очистить after
        <select value={minutes ?? ""} onChange={(event) => setMinutes(event.target.value ? Number(event.target.value) : null)}>
          <option value="">Do not clear</option>
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="240">4 hours</option>
          <option value="480">Сегодня</option>
          <option value="10080">This week</option>
        </select>
      </label>

      <div classИмя="status-presets">
        {STATUS_PRESETS.map((preset) => (
          <button
            key={preset.text}
            type="button"
            onClick={() => {
              setEmoji(preset.emoji);
              setText(preset.text);
              setMinutes(preset.minutes);
            }}
          >
            {preset.text}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Профиль editor                                                              */
/* -------------------------------------------------------------------------- */

export function ПрофильИзменитьorModal({ onЗакрыть }: { onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const session = state.session;
  const [form, setForm] = useState({
    displayИмя: session?.displayИмя ?? "",
    handle: session?.handle ?? "",
    title: session?.title ?? "",
    pronouns: session?.pronouns ?? "",
    phone: session?.phone ?? "",
    timezone: session?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Изменить your profile" onЗакрыть={onЗакрыть}>
      <form
        classИмя="stack-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await actions.updateПрофиль({
              displayИмя: form.displayИмя,
              handle: form.handle || undefined,
              title: form.title || null,
              pronouns: form.pronouns || null,
              phone: form.phone || null,
              timezone: form.timezone
            });
            actions.toast("Профиль updated", "success");
            onЗакрыть();
          } catch (error) {
            actions.fail(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div classИмя="profile-editor">
          <Avatar user={session ?? undefined} size={92} presence={false} />
          <div classИмя="stack-form grow">
            <label classИмя="field">
              Full name
              <input value={form.displayИмя} onChange={(event) => setForm({ ...form, displayИмя: event.target.value })} required />
            </label>
            <label classИмя="field">
              Handle
              <input value={form.handle} onChange={(event) => setForm({ ...form, handle: event.target.value })} placeholder="ada" />
            </label>
          </div>
        </div>
        <label classИмя="field">
          What I do
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Инженер по продукту" />
        </label>
        <label classИмя="field">
          Pronouns
          <input value={form.pronouns} onChange={(event) => setForm({ ...form, pronouns: event.target.value })} placeholder="they/them" />
        </label>
        <label classИмя="field">
          Phone
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
        <label classИмя="field">
          Time zone
          <input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
        </label>
        <div classИмя="upload-avatar">
          <span>Профиль photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file || !state.workspaceId) return;
              try {
                const { file: uploaded } = await api.files.upload(state.workspaceId, file);
                await actions.updateПрофиль({ avatarUrl: uploaded.url });
                actions.toast("Photo updated", "success");
              } catch (error) {
                actions.fail(error);
              }
            }}
          />
        </div>
        <button type="submit" classИмя="button primary" disabled={busy}>
          Сохранить changes
        </button>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Предпочтения                                                                 */
/* -------------------------------------------------------------------------- */

export function ПредпочтенияModal({ onЗакрыть }: { onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const preferences = state.session?.preferences ?? {};
  const [tab, setTab] = useState<"appearance" | "notifications" | "advanced">("appearance");
  const [keywords, setKeywords] = useState(((preferences as { keywords?: string[] }).keywords ?? []).join(", "));

  const set = (input: Record<string, unknown>) => void actions.updateПредпочтения(input);

  return (
    <Modal title="Предпочтения" onЗакрыть={onЗакрыть} width={640}>
      <div classИмя="panel-tabs" role="tablist">
        {(["appearance", "notifications", "advanced"] as const).map((entry) => (
          <button key={entry} type="button" role="tab" aria-selected={tab === entry} classИмя={tab === entry ? "is-active" : ""} onClick={() => setTab(entry)}>
            {entry === "appearance" ? "Внешний вид" : entry === "notifications" ? "Уведомления" : "Дополнительно"}
          </button>
        ))}
      </div>

      {tab === "appearance" ? (
        <div classИмя="stack-form">
          <label classИмя="field">
            Theme
            <select value={preferences.theme ?? "system"} onChange={(event) => set({ theme: event.target.value })}>
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label classИмя="field">
            Сообщение density
            <select value={preferences.messageDensity ?? "comfortable"} onChange={(event) => set({ messageDensity: event.target.value })}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label classИмя="field">
            Time format
            <select value={preferences.timeFormat ?? "12h"} onChange={(event) => set({ timeFormat: event.target.value })}>
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </label>
          <label classИмя="checkbox-field">
            <input type="checkbox" checked={preferences.enterToОтправить !== false} onChange={(event) => set({ enterToОтправить: event.target.checked })} />
            <span>
              <strong>Press Enter to send</strong>
              <small>When off, use Cmd/Ctrl+Enter to send.</small>
            </span>
          </label>
        </div>
      ) : null}

      {tab === "notifications" ? (
        <div classИмя="stack-form">
          <label classИмя="field">
            Desktop notifications
            <select value={preferences.desktopУведомления ?? "mentions"} onChange={(event) => set({ desktopУведомления: event.target.value })}>
              <option value="all">Every new message</option>
              <option value="mentions">Личное сообщениеs and mentions</option>
              <option value="none">Nothing</option>
            </select>
          </label>
          <label classИмя="field">
            Электронная почта notifications
            <select value={preferences.emailУведомления ?? "mentions"} onChange={(event) => set({ emailУведомления: event.target.value })}>
              <option value="all">Everything I miss</option>
              <option value="mentions">Личное сообщениеs and mentions</option>
              <option value="none">Nothing</option>
            </select>
          </label>
          <label classИмя="checkbox-field">
            <input type="checkbox" checked={preferences.notificationSound !== false} onChange={(event) => set({ notificationSound: event.target.checked })} />
            <span>
              <strong>Play a sound for new messages</strong>
              <small>Следитьs the desktop setting above, and pauses during your notification schedule.</small>
            </span>
          </label>
          <label classИмя="field">
            Highlight words
            <input
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              onBlur={() =>
                set({
                  keywords: keywords
                    .split(",")
                    .map((word) => word.trim())
                    .filter(Boolean)
                })
              }
              placeholder="deploy, incident, roadmap"
            />
          </label>

          <div classИмя="field">
            Notification schedule
            <p classИмя="muted small">Pause sounds, desktop alerts and email between these times.</p>
            <div classИмя="inline-field">
              <input
                type="time"
                value={preferences.quietHoursStart ?? ""}
                onChange={(event) => set({ quietHoursStart: event.target.value || null })}
                aria-label="Начало тихого времени"
              />
              <span classИмя="muted small">to</span>
              <input
                type="time"
                value={preferences.quietHoursEnd ?? ""}
                onChange={(event) => set({ quietHoursEnd: event.target.value || null })}
                aria-label="Окончание тихого времени"
              />
              {preferences.quietHoursStart || preferences.quietHoursEnd ? (
                <button
                  type="button"
                  classИмя="button ghost small"
                  onClick={() => set({ quietHoursStart: null, quietHoursEnd: null })}
                >
                  Очистить
                </button>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            classИмя="button ghost"
            onClick={async () => {
              if (typeof Notification === "undefined") return;
              const permission = await Notification.requestPermission();
              actions.toast(permission === "granted" ? "Desktop notifications enabled" : "Недостаточно прав");
            }}
          >
            Enable browser notifications
          </button>
        </div>
      ) : null}

      {tab === "advanced" ? (
        <div classИмя="stack-form">
          <label classИмя="checkbox-field">
            <input type="checkbox" checked={preferences.showUnreadsFirst === true} onChange={(event) => set({ showUnreadsFirst: event.target.checked })} />
            <span>
              <strong>Sort the sidebar by unread first</strong>
            </span>
          </label>
          <div classИмя="field">
            Sessions
            <SessionList />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function SessionList() {
  const [sessions, setSessions] = useState<Array<{ id: string; userAgent: string | null; createdAt: string }>>([]);

  useEffect(() => {
    api.auth
      .sessions()
      .then(({ sessions: list }) => setSessions(list))
      .catch(() => undefined);
  }, []);

  return (
    <div classИмя="session-list">
      {sessions.map((session) => (
        <div key={session.id} classИмя="session-row">
          <span>{session.userAgent?.slice(0, 60) ?? "Unknown device"}</span>
          <button
            type="button"
            classИмя="button ghost"
            onClick={async () => {
              await api.auth.revokeSession(session.id);
              setSessions((current) => current.filter((entry) => entry.id !== session.id));
            }}
          >
            Revoke
          </button>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Schedule and share                                                          */
/* -------------------------------------------------------------------------- */

export function ScheduleModal({
  conversationId,
  bodyText,
  parentСообщениеId,
  onЗакрыть
}: {
  conversationId: string;
  bodyText: string;
  parentСообщениеId: string | null;
  onЗакрыть: () => void;
}) {
  const { actions } = useApp();
  const [when, setWhen] = useState(() => {
    const date = new Date(Date.now() + 60 * 60_000);
    date.setSeconds(0, 0);
    return new Date(date.getTime() - date.getTimezoneВыкл.set() * 60_000).toISOString().slice(0, 16);
  });

  return (
    <Modal title="Запланировать сообщение" onЗакрыть={onЗакрыть}>
      <p classИмя="muted">This message will be sent automatically at the time you pick.</p>
      <blockquote classИмя="schedule-preview">
        <RichText text={bodyText} />
      </blockquote>
      <label classИмя="field">
        Отправить at
        <input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
      </label>
      <button
        type="button"
        classИмя="button primary"
        onClick={async () => {
          try {
            await api.conversations.schedule(conversationId, {
              bodyText,
              sendAt: new Date(when).toISOString(),
              parentСообщениеId
            });
            track("message_scheduled", {});
            actions.toast("Сообщение scheduled", "success");
            onЗакрыть();
          } catch (error) {
            actions.fail(error);
          }
        }}
      >
        Schedule
      </button>
    </Modal>
  );
}

export function ShareModal({ messageId, onЗакрыть }: { messageId: string; onЗакрыть: () => void }) {
  const { state, actions } = useApp();
  const directory = useDirectory();
  const [target, setTarget] = useState("");
  const [comment, setComment] = useState("");

  return (
    <Modal title="Поделиться сообщением" onЗакрыть={onЗакрыть}>
      <label classИмя="field">
        Share to
        <select value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="">Pick a conversation</option>
          {(state.bootstrap?.conversations ?? []).map((conversation) => (
            <option key={conversation.id} value={conversation.id}>
              {conversation.channel ? `#${conversation.channel.name}` : conversationTitle(conversation, directory, state.session?.id)}
            </option>
          ))}
        </select>
      </label>
      <label classИмя="field">
        Add a comment <span classИмя="optional">(optional)</span>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
      </label>
      <button
        type="button"
        classИмя="button primary"
        disabled={!target}
        onClick={async () => {
          try {
            const { conversationId } = await api.messages.share(messageId, { conversationId: target, comment });
            await actions.openConversation(conversationId);
            onЗакрыть();
          } catch (error) {
            actions.fail(error);
          }
        }}
      >
        Share
      </button>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Shortcuts and workspace creation                                            */
/* -------------------------------------------------------------------------- */

const SHORTCUTS: Array<[string, string]> = [
  ["⌘K / Ctrl+K", "Перейти к a conversation or person"],
  ["⌘/ / Ctrl+/", "Show this shortcut list"],
  ["⌘⇧K", "Start a direct message"],
  ["⌘⇧A", "Go to all unreads"],
  ["⌘⇧T", "Go to threads"],
  ["Alt+Shift+N", "Open a new chat tab"],
  ["Alt+Shift+W", "Закрыть the active chat tab"],
  ["Alt+Shift+T", "Reopen the last closed chat tab"],
  ["Alt+1…9", "Switch chat tabs (9 selects the last)"],
  ["← / → / Home / End", "Switch tabs when a tab is focused"],
  ["Alt+Shift+← / →", "Reorder the focused chat tab"],
  ["Удалить / Shift+F10", "Закрыть focused tab / open tab menu"],
  ["Alt+↑ / Alt+↓", "Previous or next conversation"],
  ["⇧Esc", "Mark everything read"],
  ["⌘B / ⌘I", "Bold or italic in the composer"],
  ["Enter", "Отправить the message"],
  ["Shift+Enter", "New line"],
  ["↑", "Изменить your last message"],
  ["Esc", "Закрыть the panel, modal or thread"]
];

export function ShortcutsModal({ onЗакрыть }: { onЗакрыть: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onЗакрыть={onЗакрыть}>
      <ul classИмя="shortcut-list">
        {SHORTCUTS.map(([keys, description]) => (
          <li key={keys}>
            <kbd>{keys}</kbd>
            <span>{description}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function СоздатьWorkspaceModal({ onЗакрыть }: { onЗакрыть: () => void }) {
  const { actions } = useApp();
  const [name, setИмя] = useState("");

  return (
    <Modal title="Создать a workspace" onЗакрыть={onЗакрыть}>
      <form
        classИмя="stack-form"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const { workspace } = await api.workspaces.create(name);
            track("workspace_created", {});
            const { user, workspaces } = await api.auth.me();
            actions.setSession(user, workspaces);
            await actions.selectWorkspace(workspace.id);
            onЗакрыть();
          } catch (error) {
            actions.fail(error);
          }
        }}
      >
        <label classИмя="field">
          Название рабочего пространства
          <input value={name} onChange={(event) => setИмя(event.target.value)} placeholder="Acme Inc" required autoFocus />
        </label>
        <button type="submit" classИмя="button primary" disabled={name.trim().length < 2}>
          Создать workspace
        </button>
      </form>
    </Modal>
  );
}
