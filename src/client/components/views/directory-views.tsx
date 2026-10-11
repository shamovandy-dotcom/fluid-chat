"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Hash, Lock, Поиск } from "lucide-react";
import type { ChannelSummary, FileSummary, СообщениеDto } from "@/shared/types";
import { api } from "../../api";
import { track } from "../../analytics";
import { formatBytes, formatRelative } from "../../format";
import { useApp, useDirectory } from "../../store";
import { Avatar, EmptyState, Spinner } from "../ui/primitives";
import { СообщениеItem } from "../message/message-item";
import { HighlightProvider } from "../message/rich-text";

type DirectoryChannel = ChannelSummary & { conversationId: string; joined: boolean };

export function BrowseКаналыView() {
  const { state, actions } = useApp();
  const [channels, setКаналы] = useState<DirectoryChannel[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "joined" | "unjoined" | "archived">("all");

  useEffect(() => {
    if (!state.workspaceId) return;
    api.channels
      .list(state.workspaceId, { includeВ архиве: filter === "archived" })
      .then(({ channels: list }) => setКаналы(list))
      .catch(() => setКаналы([]));
  }, [state.workspaceId, filter]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (channels ?? [])
      .filter((channel) => (term ? channel.name.includes(term) || channel.description?.toLowerCase().includes(term) : true))
      .filter((channel) => {
        if (filter === "joined") return channel.joined;
        if (filter === "unjoined") return !channel.joined;
        if (filter === "archived") return !!channel.archivedAt;
        return !channel.archivedAt;
      });
  }, [channels, filter, query]);

  return (
    <section classИмя="view">
      <header classИмя="view-header">
        <div>
          <h1>Каналы</h1>
          <p>{visible.length} channels in this workspace</p>
        </div>
        <button type="button" classИмя="button primary" onClick={() => actions.setModal({ kind: "new-channel" })}>
          Создать channel
        </button>
      </header>

      <div classИмя="view-toolbar">
        <div classИмя="search-field">
          <Поиск size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск channels" />
        </div>
        <div classИмя="view-filters">
          {(["all", "joined", "unjoined", "archived"] as const).map((entry) => (
            <button key={entry} type="button" classИмя={filter === entry ? "is-active" : ""} onClick={() => setFilter(entry)}>
              {entry === "all" ? "All" : entry === "joined" ? "My channels" : entry === "unjoined" ? "Не присоединился" : "В архиве"}
            </button>
          ))}
        </div>
      </div>

      <div classИмя="view-scroll">
        {!channels ? (
          <Spinner label="Загрузка… channels" />
        ) : visible.length === 0 ? (
          <EmptyState title="Каналы не найдены" body="Измените запрос или создайте канал." />
        ) : (
          visible.map((channel) => (
            <div key={channel.id} classИмя="channel-row">
              <button type="button" classИмя="channel-row-main" onClick={() => void actions.openConversation(channel.conversationId)}>
                <span classИмя="channel-row-name">
                  {channel.visibility === "private" ? <Lock size={14} /> : <Hash size={15} />}
                  {channel.name}
                  {channel.archivedAt ? <span classИмя="pill">archived</span> : null}
                </span>
                <span classИмя="channel-row-meta">
                  {channel.memberCount ?? 0} members
                  {channel.description ? ` · ${channel.description}` : ""}
                </span>
              </button>
              {channel.joined ? (
                <span classИмя="pill">Joined</span>
              ) : (
                <button
                  type="button"
                  classИмя="button ghost"
                  onClick={async () => {
                    try {
                      await api.channels.join(channel.id);
                      await actions.refreshBootstrap();
                      await actions.openConversation(channel.conversationId);
                    } catch (error) {
                      actions.fail(error);
                    }
                  }}
                >
                  Join
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function ЛюдиView() {
  const { state, actions } = useApp();
  const [query, setQuery] = useState("");
  const members = state.bootstrap?.members ?? [];

  const visible = members.filter((member) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return `${member.user.displayИмя} ${member.user.handle ?? ""} ${member.user.title ?? ""}`
      .toLowerCase()
      .includes(term);
  });

  return (
    <section classИмя="view">
      <header classИмя="view-header">
        <div>
          <h1>Люди</h1>
          <p>{members.length} members</p>
        </div>
        <button type="button" classИмя="button primary" onClick={() => actions.setModal({ kind: "invite" })}>
          Пригласить участников
        </button>
      </header>

      <div classИмя="view-toolbar">
        <div classИмя="search-field">
          <Поиск size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск people" />
        </div>
      </div>

      <div classИмя="people-grid">
        {visible.map((member) => (
          <button
            key={member.user.id}
            type="button"
            classИмя="person-card"
            onClick={() => actions.setRightPanel({ kind: "profile", userId: member.user.id })}
          >
            <Avatar user={member.user} size={56} />
            <strong>{member.user.displayИмя}</strong>
            <span>{member.user.title ?? (member.role === "owner" ? "Workspace owner" : member.role)}</span>
            {member.user.statusText ? <small>{member.user.statusText}</small> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ФайлыView() {
  const { state } = useApp();
  const directory = useDirectory();
  const [files, setФайлы] = useState<FileSummary[] | null>(null);

  useEffect(() => {
    if (!state.workspaceId) return;
    api.activity
      .files(state.workspaceId)
      .then(({ files: list }) => setФайлы(list))
      .catch(() => setФайлы([]));
  }, [state.workspaceId]);

  return (
    <section classИмя="view">
      <header classИмя="view-header">
        <div>
          <h1>Файлы</h1>
          <p>Everything shared in conversations you are in</p>
        </div>
      </header>
      <div classИмя="view-scroll">
        {!files ? (
          <Spinner label="Загрузка… files" />
        ) : files.length === 0 ? (
          <EmptyState title="No files yet" body="Attach a file to a message to see it here." />
        ) : (
          <div classИмя="file-grid wide">
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
                  <small>
                    {formatBytes(file.size)} · {directory.get(file.uploaderId)?.displayИмя ?? "Someone"} ·{" "}
                    {formatRelative(file.createdAt)}
                  </small>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ПоискView({ query }: { query: string }) {
  const { state, actions } = useApp();
  const [term, setTerm] = useState(query);
  // Highlight the free-text words, not the operator tokens.
  const highlightTerms = useMemo(
    () =>
      term
        .split(/\s+/)
        .filter((word) => word && !/^\w+:/.test(word))
        .map((word) => word.replace(/^["']|["']$/g, "")),
    [term]
  );
  const [sort, setSort] = useState<"recent" | "relevant">("recent");
  const [results, setResults] = useState<Array<{ message: СообщениеDto; conversationId: string; channelИмя: string | null }> | null>(
    null
  );

  useEffect(() => setTerm(query), [query]);

  useEffect(() => {
    if (!state.workspaceId || !term.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setResults(null);
    api.activity
      .search(state.workspaceId, term, sort)
      .then(({ results: list }) => {
        if (cancelled) return;
        setResults(list);
        // Вкл.ly the committed query counts as a search. `term` changes on every keystroke,
        // so tracking unconditionally here would emit one event per character typed.
        if (term === query) {
          track("search_performed", { sort, query_length: term.trim().length, result_count: list.length });
        }
      })
      .catch(() => !cancelled && setResults([]));
    return () => {
      cancelled = true;
    };
  }, [state.workspaceId, term, sort, query]);

  return (
    <section classИмя="view">
      <header classИмя="view-header">
        <div>
          <h1>Поиск</h1>
          <p>
            Operators: <code>in:#channel</code> <code>from:@person</code> <code>has:file</code> <code>before:2026-01-01</code>
          </p>
        </div>
      </header>

      <div classИмя="view-toolbar">
        <form
          classИмя="search-field grow"
          onSubmit={(event) => {
            event.preventDefault();
            actions.setView({ kind: "search", query: term });
          }}
        >
          <Поиск size={15} />
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Поиск messages" autoFocus />
        </form>
        <div classИмя="view-filters">
          {(["recent", "relevant"] as const).map((entry) => (
            <button key={entry} type="button" classИмя={sort === entry ? "is-active" : ""} onClick={() => setSort(entry)}>
              Most {entry}
            </button>
          ))}
        </div>
      </div>

      <div classИмя="view-scroll">
        {!results ? (
          <Spinner label="Поискing" />
        ) : results.length === 0 ? (
          <EmptyState title="Совпадений не найдено" body="Измените запрос или расширьте фильтры." />
        ) : (
          <HighlightProvider terms={highlightTerms}>
            {results.map((result) => (
              <div key={result.message.id} classИмя="search-result">
                <button
                  type="button"
                  classИмя="search-result-head"
                  onClick={() => void actions.openConversation(result.conversationId)}
                >
                  {result.channelИмя ? `#${result.channelИмя}` : "Личное сообщение"}
                  <time>{formatRelative(result.message.createdAt)}</time>
                </button>
                <СообщениеItem message={result.message} context="list" />
              </div>
            ))}
          </HighlightProvider>
        )}
      </div>
    </section>
  );
}
