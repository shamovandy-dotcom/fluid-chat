"use client";

import { useCallback, useEffect, useState } from "react";
import { Hash, Lock, RefreshCw, Trash2 } from "lucide-react";
import type { ChannelSummary, CustomEmojiDto, PublicUser } from "@/shared/types";
import { api } from "../../api";
import type { ApiKeyDto } from "../../api";
import { formatRelative } from "../../format";
import { useApp } from "../../store";
import { Avatar, Modal, Spinner } from "../ui/primitives";

type Tab = "overview" | "members" | "invitations" | "channels" | "emoji" | "api" | "settings" | "audit" | "export";

type MemberRow = { memberId: string; role: string; status: string; user: PublicUser };
type ПригласитьRow = {
  id: string;
  email: string | null;
  role: string;
  inviteType: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  useCount: number;
  maxUses: number | null;
};

export function AdminConsole({ onЗакрыть }: { onЗакрыть: () => void }) {
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const workspaceId = state.workspaceId;
  const isOwner = state.bootstrap?.role === "owner";

  return (
    <Modal title={`${state.bootstrap?.workspace.name ?? "Workspace"} settings`} onЗакрыть={onЗакрыть} width={860}>
      <div classИмя="panel-tabs wrap" role="tablist">
        {(
          [
            ["overview", "Overview"],
            ["members", "Участники"],
            ["invitations", "Invitations"],
            ["channels", "Каналы"],
            ["emoji", "Emoji"],
            ["api", "API keys"],
            ["settings", "Настройки"],
            ["audit", "Audit log"],
            ["export", "Export"]
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} classИмя={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>

      {!workspaceId ? null : (
        <div classИмя="admin-body">
          {tab === "overview" ? <Overview workspaceId={workspaceId} /> : null}
          {tab === "members" ? <Участники workspaceId={workspaceId} isOwner={isOwner} /> : null}
          {tab === "invitations" ? <Invitations workspaceId={workspaceId} /> : null}
          {tab === "channels" ? <Каналы workspaceId={workspaceId} /> : null}
          {tab === "emoji" ? <Emoji workspaceId={workspaceId} /> : null}
          {tab === "api" ? <ApiKeys workspaceId={workspaceId} /> : null}
          {tab === "settings" ? <Настройки workspaceId={workspaceId} isOwner={isOwner} /> : null}
          {tab === "audit" ? <AuditLog workspaceId={workspaceId} /> : null}
          {tab === "export" ? <Exports workspaceId={workspaceId} isOwner={isOwner} /> : null}
          <p classИмя="admin-note">
            Signed in as {state.session?.email} · role: {state.bootstrap?.role}
          </p>
        </div>
      )}
    </Modal>
  );
}

function Overview({ workspaceId }: { workspaceId: string }) {
  const [usage, setUsage] = useState<{ activeУчастники: number; pendingПригласитьs: number; fileCount: number } | null>(null);
  const { state } = useApp();

  useEffect(() => {
    api.workspaces
      .usage(workspaceId)
      .then(({ usage: value }) => setUsage(value))
      .catch(() => setUsage(null));
  }, [workspaceId]);

  const workspace = state.bootstrap?.workspace;

  return (
    <div classИмя="admin-grid">
      <div classИмя="stat-card">
        <span>Участники</span>
        <strong>{usage?.activeУчастники ?? "—"}</strong>
        <small>of {workspace?.seatLimit ?? 0} seats</small>
      </div>
      <div classИмя="stat-card">
        <span>Pending invites</span>
        <strong>{usage?.pendingПригласитьs ?? "—"}</strong>
      </div>
      <div classИмя="stat-card">
        <span>Файлы</span>
        <strong>{usage?.fileCount ?? "—"}</strong>
      </div>
      <div classИмя="stat-card">
        <span>Plan</span>
        <strong classИмя="capitalize">{workspace?.plan ?? "free"}</strong>
        <small classИмя="capitalize">{workspace?.subscriptionСтатус}</small>
      </div>
    </div>
  );
}

function Участники({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const { actions } = useApp();
  const [members, setУчастники] = useState<MemberRow[] | null>(null);

  const load = useCallback(() => {
    api.workspaces
      .members(workspaceId, true)
      .then(({ members: list }) => setУчастники(list as MemberRow[]))
      .catch(() => setУчастники([]));
  }, [workspaceId]);

  useEffect(load, [load]);

  if (!members) return <Spinner label="Загрузка участников" />;

  return (
    <div classИмя="admin-list">
      {members.map((member) => (
        <div key={member.memberId} classИмя="admin-row">
          <div classИмя="admin-row-main">
            <Avatar user={member.user} size={32} />
            <span>
              <strong>{member.user.displayИмя}</strong>
              <small>
                {member.user.email} · {member.status}
              </small>
            </span>
          </div>
          <div classИмя="admin-row-actions">
            {isOwner ? (
              <select
                value={member.role}
                onChange={async (event) => {
                  try {
                    await api.workspaces.updateMember(workspaceId, member.memberId, { role: event.target.value });
                    load();
                    await actions.refreshBootstrap();
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="guest">Guest</option>
              </select>
            ) : (
              <span classИмя="pill capitalize">{member.role}</span>
            )}
            {member.status === "active" ? (
              <button
                type="button"
                classИмя="button ghost"
                onClick={async () => {
                  if (!window.confirm(`Удалить ${member.user.displayИмя} from the workspace?`)) return;
                  try {
                    await api.workspaces.removeMember(workspaceId, member.memberId);
                    load();
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                Удалить
              </button>
            ) : (
              <button
                type="button"
                classИмя="button ghost"
                onClick={async () => {
                  try {
                    await api.workspaces.updateMember(workspaceId, member.memberId, { status: "active" });
                    load();
                  } catch (error) {
                    actions.fail(error);
                  }
                }}
              >
                Reactivate
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Invitations({ workspaceId }: { workspaceId: string }) {
  const { actions } = useApp();
  const [invites, setПригласитьs] = useState<ПригласитьRow[] | null>(null);

  const load = useCallback(() => {
    api.invites
      .list(workspaceId)
      .then(({ invites: list }) => setПригласитьs(list as ПригласитьRow[]))
      .catch(() => setПригласитьs([]));
  }, [workspaceId]);

  useEffect(load, [load]);

  if (!invites) return <Spinner label="Загрузка приглашений" />;
  const pending = invites.filter((invite) => !invite.acceptedAt && !invite.revokedAt && new Date(invite.expiresAt) > new Date());

  return (
    <div classИмя="admin-list">
      {pending.length === 0 ? <p classИмя="muted">No pending invitations.</p> : null}
      {pending.map((invite) => (
        <div key={invite.id} classИмя="admin-row">
          <div classИмя="admin-row-main">
            <span>
              <strong>{invite.email ?? "Shareable invite link"}</strong>
              <small>
                {invite.role} · expires {formatRelative(invite.expiresAt)}
                {invite.maxUses ? ` · ${invite.useCount}/${invite.maxUses} uses` : ""}
              </small>
            </span>
          </div>
          <div classИмя="admin-row-actions">
            <button
              type="button"
              classИмя="button ghost"
              onClick={async () => {
                try {
                  const { inviteUrl } = await api.invites.resend(invite.id);
                  void navigator.clipboard.writeText(inviteUrl);
                  actions.toast("New invite link copied to clipboard", "success");
                  load();
                } catch (error) {
                  actions.fail(error);
                }
              }}
            >
              <RefreshCw size={13} /> Resend
            </button>
            <button
              type="button"
              classИмя="button ghost"
              onClick={async () => {
                await api.invites.revoke(invite.id);
                load();
              }}
            >
              Revoke
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Каналы({ workspaceId }: { workspaceId: string }) {
  const { actions } = useApp();
  const [channels, setКаналы] = useState<Array<ChannelSummary & { conversationId: string }> | null>(null);

  const load = useCallback(() => {
    api.channels
      .list(workspaceId, { includeВ архиве: true })
      .then(({ channels: list }) => setКаналы(list))
      .catch(() => setКаналы([]));
  }, [workspaceId]);

  useEffect(load, [load]);

  if (!channels) return <Spinner label="Загрузка… channels" />;

  return (
    <div classИмя="admin-list">
      {channels.map((channel) => (
        <div key={channel.id} classИмя="admin-row">
          <div classИмя="admin-row-main">
            {channel.visibility === "private" ? <Lock size={14} /> : <Hash size={15} />}
            <span>
              <strong>{channel.name}</strong>
              <small>
                {channel.memberCount ?? 0} members{channel.archivedAt ? " · archived" : ""}
              </small>
            </span>
          </div>
          <div classИмя="admin-row-actions">
            {channel.archivedAt ? (
              <button
                type="button"
                classИмя="button ghost"
                onClick={async () => {
                  await api.channels.unarchive(channel.id);
                  load();
                  await actions.refreshBootstrap();
                }}
              >
                Unarchive
              </button>
            ) : channel.name !== "general" ? (
              <button
                type="button"
                classИмя="button ghost"
                onClick={async () => {
                  if (!window.confirm(`Archive #${channel.name}?`)) return;
                  await api.channels.archive(channel.id);
                  load();
                  await actions.refreshBootstrap();
                }}
              >
                Archive
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Emoji({ workspaceId }: { workspaceId: string }) {
  const { actions } = useApp();
  const [emoji, setEmoji] = useState<CustomEmojiDto[] | null>(null);
  const [name, setИмя] = useState("");

  const load = useCallback(() => {
    api.workspaces
      .emoji(workspaceId)
      .then(({ emoji: list }) => setEmoji(list))
      .catch(() => setEmoji([]));
  }, [workspaceId]);

  useEffect(load, [load]);

  return (
    <div classИмя="stack-form">
      <label classИмя="field">
        Add custom emoji
        <div classИмя="emoji-upload">
          <input value={name} onChange={(event) => setИмя(event.target.value)} placeholder="party-parrot" />
          <input
            type="file"
            accept="image/*"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file || !name.trim()) {
                actions.toast("Имя the emoji first", "error");
                return;
              }
              try {
                const { file: uploaded } = await api.files.upload(workspaceId, file);
                await api.workspaces.createEmoji(workspaceId, name.trim().toLowerCase(), uploaded.id);
                setИмя("");
                load();
                await actions.refreshBootstrap();
              } catch (error) {
                actions.fail(error);
              }
            }}
          />
        </div>
      </label>
      <div classИмя="emoji-admin-grid">
        {(emoji ?? []).map((entry) => (
          <div key={entry.id} classИмя="emoji-admin-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.imageUrl} alt={`:${entry.name}:`} width={28} height={28} />
            <code>:{entry.name}:</code>
            <button
              type="button"
              classИмя="icon-button"
              aria-label={`Удалить :${entry.name}:`}
              onClick={async () => {
                await api.workspaces.deleteEmoji(entry.id);
                load();
                await actions.refreshBootstrap();
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {emoji?.length === 0 ? <p classИмя="muted">No custom emoji yet.</p> : null}
      </div>
    </div>
  );
}

const DEFAULT_SCOPES = ["messages:read", "messages:write", "channels:read", "conversations:read"];

function ApiKeys({ workspaceId }: { workspaceId: string }) {
  const { actions } = useApp();
  const [keys, setKeys] = useState<ApiKeyDto[] | null>(null);
  const [catalogue, setCatalogue] = useState<Array<{ scope: string; summary: string }>>([]);
  const [secret, setSecret] = useState<{ token: string; name: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    identity: "bot" as "bot" | "self",
    botRole: "member" as "member" | "admin",
    scopes: DEFAULT_SCOPES,
    rateLimitPerMinute: 120,
    messageLimitPerMinute: 60,
    expiresInDays: ""
  });

  const load = useCallback(() => {
    api.apiKeys
      .list(workspaceId)
      .then(({ apiKeys }) => setKeys(apiKeys))
      .catch(() => setKeys([]));
  }, [workspaceId]);

  useEffect(load, [load]);
  useEffect(() => {
    api.apiKeys
      .scopes()
      .then(({ scopes }) => setCatalogue(scopes))
      .catch(() => setCatalogue([]));
  }, []);

  const toggleScope = (scope: string) =>
    setForm((current) => ({
      ...current,
      scopes: current.scopes.includes(scope)
        ? current.scopes.filter((entry) => entry !== scope)
        : [...current.scopes, scope]
    }));

  return (
    <div classИмя="stack-form">
      <p classИмя="muted">
        An API key calls the same endpoints this app does, so anything a person can do here, a script or an agent can
        automate. Keys are pinned to this workspace, limited to the scopes you grant and rate limited per key. The full
        route list lives at <code>/api/meta/routes</code>.
      </p>

      {secret ? (
        <div classИмя="api-key-reveal">
          <strong>Копировать “{secret.name}” now — this is the only time it is shown.</strong>
          <code>{secret.token}</code>
          <div classИмя="admin-row-actions">
            <button
              type="button"
              classИмя="button primary"
              onClick={() => {
                void navigator.clipboard.writeText(secret.token);
                actions.toast("API key copied to clipboard", "success");
              }}
            >
              Копировать key
            </button>
            <button type="button" classИмя="button ghost" onClick={() => setSecret(null)}>
              Готово
            </button>
          </div>
          <small>
            Try it: <code>curl -H &quot;Authorization: Bearer {secret.token.slice(0, 14)}…&quot; {location.origin}/api/auth/me</code>
          </small>
        </div>
      ) : null}

      <form
        classИмя="stack-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (form.scopes.length === 0) {
            actions.toast("Grant at least one scope", "error");
            return;
          }
          try {
            const { apiKey, token } = await api.apiKeys.create(workspaceId, {
              name: form.name.trim(),
              scopes: form.scopes,
              identity: form.identity,
              botRole: form.botRole,
              rateLimitPerMinute: form.rateLimitPerMinute,
              messageLimitPerMinute: form.messageLimitPerMinute,
              expiresInDays: form.expiresInDays === "" ? null : Number(form.expiresInDays)
            });
            setSecret({ token, name: apiKey.name });
            setForm({ ...form, name: "" });
            load();
          } catch (error) {
            actions.fail(error);
          }
        }}
      >
        <label classИмя="field">
          Key name
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Бот релизов"
            required
          />
        </label>

        <div classИмя="api-key-row">
          <label classИмя="field">
            Acts as
            <select
              value={form.identity}
              onChange={(event) => setForm({ ...form, identity: event.target.value as "bot" | "self" })}
            >
              <option value="bot">Its own bot identity</option>
              <option value="self">Me</option>
            </select>
          </label>
          {form.identity === "bot" ? (
            <label classИмя="field">
              Bot role
              <select
                value={form.botRole}
                onChange={(event) => setForm({ ...form, botRole: event.target.value as "member" | "admin" })}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          ) : null}
          <label classИмя="field">
            Requests / minute
            <input
              type="number"
              min={1}
              max={6000}
              value={form.rateLimitPerMinute}
              onChange={(event) => setForm({ ...form, rateLimitPerMinute: Number(event.target.value) })}
            />
          </label>
          <label classИмя="field">
            Сообщениеs / minute
            <input
              type="number"
              min={1}
              max={6000}
              value={form.messageLimitPerMinute}
              onChange={(event) => setForm({ ...form, messageLimitPerMinute: Number(event.target.value) })}
            />
          </label>
          <label classИмя="field">
            Expires in days
            <input
              type="number"
              min={1}
              value={form.expiresInDays}
              placeholder="never"
              onChange={(event) => setForm({ ...form, expiresInDays: event.target.value })}
            />
          </label>
        </div>

        <fieldset classИмя="scope-grid">
          <legend>Scopes</legend>
          {catalogue.map((entry) => (
            <label key={entry.scope} classИмя="checkbox-field">
              <input
                type="checkbox"
                checked={form.scopes.includes(entry.scope)}
                onChange={() => toggleScope(entry.scope)}
              />
              <span>
                <strong>{entry.scope}</strong>
                <small>{entry.summary}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <button type="submit" classИмя="button primary">
          Создать API key
        </button>
      </form>

      {!keys ? (
        <Spinner label="Загрузка API-ключей" />
      ) : (
        <div classИмя="admin-list">
          {keys.length === 0 ? <p classИмя="muted">No API keys yet.</p> : null}
          {keys.map((key) => (
            <div key={key.id} classИмя="admin-row">
              <div classИмя="admin-row-main">
                <span>
                  <strong>
                    {key.name} <code>{key.prefix}…</code>
                  </strong>
                  <small>
                    as {key.actor.displayИмя}
                    {key.actor.isBot ? " (bot)" : ""} · {key.scopes.length} scopes · {key.rateLimitPerMinute}/min ·{" "}
                    {key.requestCount} calls ·{" "}
                    {key.lastUsedAt ? `last used ${formatRelative(key.lastUsedAt)}` : "never used"}
                    {key.expiresAt ? ` · expires ${formatRelative(key.expiresAt)}` : ""}
                  </small>
                </span>
              </div>
              <div classИмя="admin-row-actions">
                <button
                  type="button"
                  classИмя="button ghost"
                  onClick={async () => {
                    if (!window.confirm(`Rotate “${key.name}”? The current secret stops working immediately.`)) return;
                    try {
                      const { token } = await api.apiKeys.rotate(key.id);
                      setSecret({ token, name: key.name });
                      load();
                    } catch (error) {
                      actions.fail(error);
                    }
                  }}
                >
                  <RefreshCw size={13} /> Rotate
                </button>
                <button
                  type="button"
                  classИмя="button ghost"
                  onClick={async () => {
                    if (!window.confirm(`Revoke “${key.name}”? Anything using it stops working.`)) return;
                    try {
                      await api.apiKeys.revoke(key.id);
                      load();
                    } catch (error) {
                      actions.fail(error);
                    }
                  }}
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Настройки({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const { state, actions } = useApp();
  const workspace = state.bootstrap?.workspace;
  const [form, setForm] = useState({
    name: workspace?.name ?? "",
    description: workspace?.description ?? "",
    iconEmoji: workspace?.iconEmoji ?? "",
    membersCanПригласить: workspace?.membersCanПригласить ?? true,
    membersCanСоздатьКаналы: workspace?.membersCanСоздатьКаналы ?? true,
    retentionDays: workspace?.retentionDays ?? ""
  });

  return (
    <form
      classИмя="stack-form"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api.workspaces.update(workspaceId, {
            name: form.name,
            description: form.description || null,
            iconEmoji: form.iconEmoji || null,
            membersCanПригласить: form.membersCanПригласить,
            membersCanСоздатьКаналы: form.membersCanСоздатьКаналы,
            retentionDays: form.retentionDays === "" ? null : Number(form.retentionDays)
          });
          await actions.refreshBootstrap();
          actions.toast("Workspace updated", "success");
        } catch (error) {
          actions.fail(error);
        }
      }}
    >
      <label classИмя="field">
        Название рабочего пространства
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label classИмя="field">
        Описание
        <textarea value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label classИмя="field">
        Icon emoji
        <input value={form.iconEmoji ?? ""} onChange={(event) => setForm({ ...form, iconEmoji: event.target.value })} placeholder="🚀" />
      </label>
      <label classИмя="checkbox-field">
        <input type="checkbox" checked={form.membersCanПригласить} onChange={(event) => setForm({ ...form, membersCanПригласить: event.target.checked })} />
        <span>
          <strong>Участники can invite people</strong>
        </span>
      </label>
      <label classИмя="checkbox-field">
        <input
          type="checkbox"
          checked={form.membersCanСоздатьКаналы}
          onChange={(event) => setForm({ ...form, membersCanСоздатьКаналы: event.target.checked })}
        />
        <span>
          <strong>Участники can create channels</strong>
        </span>
      </label>
      {isOwner ? (
        <label classИмя="field">
          Сообщение retention (days, blank keeps forever)
          <input
            type="number"
            min={1}
            value={form.retentionDays ?? ""}
            onChange={(event) => setForm({ ...form, retentionDays: event.target.value })}
          />
        </label>
      ) : null}
      <button type="submit" classИмя="button primary">
        Сохранить settings
      </button>
    </form>
  );
}

function AuditLog({ workspaceId }: { workspaceId: string }) {
  const [events, setEvents] = useState<Array<{ id: string; type: string; createdAt: string; actor: { displayИмя: string } | null }> | null>(
    null
  );

  useEffect(() => {
    api.workspaces
      .auditEvents(workspaceId)
      .then(({ auditEvents }) => setEvents(auditEvents))
      .catch(() => setEvents([]));
  }, [workspaceId]);

  if (!events) return <Spinner label="Загрузка журнала аудита" />;

  return (
    <div classИмя="admin-list">
      {events.map((event) => (
        <div key={event.id} classИмя="admin-row compact">
          <span>
            <strong>{event.type}</strong>
            <small>{event.actor?.displayИмя ?? "system"}</small>
          </span>
          <time>{formatRelative(event.createdAt)}</time>
        </div>
      ))}
    </div>
  );
}

function Exports({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const { actions } = useApp();
  const [jobs, setJobs] = useState<Array<{ id: string; status: string; createdAt: string; fileUrl: string | null }> | null>(null);

  const load = useCallback(() => {
    api.workspaces
      .exports(workspaceId)
      .then(({ exportJobs }) => setJobs(exportJobs))
      .catch(() => setJobs([]));
  }, [workspaceId]);

  useEffect(load, [load]);

  if (!isOwner) return <p classИмя="muted">Вкл.ly workspace owners can export data.</p>;

  return (
    <div classИмя="stack-form">
      <p classИмя="muted">
        Exports include every message, channel, member and active file manifest as JSONL and CSV, stored in object storage
        for 7 days.
      </p>
      <button
        type="button"
        classИмя="button primary"
        onClick={async () => {
          try {
            await api.workspaces.requestExport(workspaceId);
            actions.toast("Export queued — it will appear below when ready", "success");
            setTimeout(load, 2000);
          } catch (error) {
            actions.fail(error);
          }
        }}
      >
        Start a new export
      </button>
      <div classИмя="admin-list">
        {(jobs ?? []).map((job) => (
          <div key={job.id} classИмя="admin-row compact">
            <span>
              <strong classИмя="capitalize">{job.status}</strong>
              <small>{job.fileUrl ?? "Preparing…"}</small>
            </span>
            <time>{formatRelative(job.createdAt)}</time>
          </div>
        ))}
      </div>
    </div>
  );
}
