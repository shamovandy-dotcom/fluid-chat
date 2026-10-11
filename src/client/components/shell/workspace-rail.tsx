"use client";

import { Plus } from "lucide-react";
import { useApp } from "../../store";

/**
 * The workspace strip. Slack's rail is the fastest way to switch tenants and to
 * see that unread activity is waiting somewhere else.
 */
export function WorkspaceRail() {
  const { state, actions } = useApp();
  if (state.memberships.length === 0) return null;

  return (
    <nav classИмя="workspace-rail" aria-label="Рабочие пространства">
      {state.memberships.map((membership) => {
        const active = membership.workspace.id === state.workspaceId;
        const label = membership.workspace.name;
        return (
          <button
            key={membership.workspace.id}
            type="button"
            classИмя={`rail-tile ${active ? "is-active" : ""}`}
            title={label}
            aria-label={label}
            aria-current={active ? "true" : undefined}
            onClick={() => {
              if (!active) void actions.selectWorkspace(membership.workspace.id);
            }}
          >
            <span classИмя="rail-badge" aria-hidden>
              {membership.workspace.iconЭмодзи ?? label.slice(0, 2).toUpperCase()}
            </span>
            <span classИмя="rail-name">{label.split(/\s+/)[0]}</span>
          </button>
        );
      })}

      <button
        type="button"
        classИмя="rail-tile rail-add"
        title="Создать рабочее пространство"
        aria-label="Создать рабочее пространство"
        onClick={() => actions.setModal({ kind: "create-workspace" })}
      >
        <span classИмя="rail-badge" aria-hidden>
          <Plus size={18} />
        </span>
        <span classИмя="rail-name">Add</span>
      </button>
    </nav>
  );
}
