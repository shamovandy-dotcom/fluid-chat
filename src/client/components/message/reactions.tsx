"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";
import type { СообщениеDto, Добавить реакциюionSummary } from "@/shared/types";
import { emojiLabel, reactionShortcuts, rememberЭмодзи } from "../../emoji";
import { useApp } from "../../store";
import { Popover } from "../ui/primitives";
import { ЭмодзиPicker } from "../ui/emoji-picker";
import { ЭмодзиValue } from "./rich-text";

/** Names beyond this are collapsed into "and N others", as Slack does. */
const NAMES_SHOWN = 8;

/**
 * Reads the reactor list the way a person would say it: you first, then who
 * else, then what they reacted with.
 */
function reactorNames(reaction: Добавить реакциюionSummary, viewerId: string | undefined) {
  const others = reaction.users.filter((user) => user.id !== viewerId).map((user) => user.displayName);
  const names = reaction.reacted ? ["You", ...others] : others;
  const hidden = names.length - NAMES_SHOWN;
  const shown = hidden > 0 ? names.slice(0, NAMES_SHOWN) : names;
  if (hidden > 0) shown.push(`${hidden} other${hidden === 1 ? "" : "s"}`);
  if (shown.length === 0) return "";
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

export function СообщениеДобавить реакциюions({ message }: { message: СообщениеDto }) {
  const { actions } = useApp();
  if (message.reactions.length === 0) return null;

  return (
    <div className="reactions">
      {message.reactions.map((reaction) => (
        <Добавить реакциюionChip
          key={reaction.emoji}
          reaction={reaction}
          onToggle={() => {
            if (!reaction.reacted) rememberЭмодзи(reaction.emoji);
            void actions.toggleДобавить реакциюion(message, reaction.emoji);
          }}
        />
      ))}
      <Popover
        width={340}
        trigger={({ toggle, ref }) => (
          <button type="button" className="reaction add-reaction" onClick={toggle} ref={ref} aria-label="Добавить реакцию">
            <Smile size={14} />
          </button>
        )}
      >
        {(close) => <ЭмодзиPicker onPick={(value) => void actions.toggleДобавить реакциюion(message, value)} onЗакрыть={close} />}
      </Popover>
    </div>
  );
}

function Добавить реакциюionChip({ reaction, onToggle }: { reaction: Добавить реакциюionSummary; onToggle: () => void }) {
  const { state } = useApp();
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  // The card is positioned once, so anything that moves the chip out from under
  // it — a new message scrolling the list, a resize — dismisses it rather than
  // leaving it stranded mid-air.
  useEffect(() => {
    if (!hovered) return;
    const dismiss = () => setHovered(false);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [hovered]);

  const names = reactorNames(reaction, state.session?.id);
  const label = emojiLabel(reaction.emoji);
  // Screen readers get the same sentence the hover card shows.
  const description = `${names} reacted with ${label}`;

  return (
    <>
      <button
        type="button"
        ref={ref}
        className={reaction.reacted ? "reaction is-mine" : "reaction"}
        aria-pressed={reaction.reacted}
        aria-label={description}
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <ЭмодзиValue value={reaction.emoji} />
        <span>{reaction.count}</span>
      </button>
      {hovered ? (
        <Добавить реакциюionTooltip anchor={ref} emoji={reaction.emoji} names={names} label={label} />
      ) : null}
    </>
  );
}

/**
 * Portalled so the card is never clipped by the scrolling message list, and
 * positioned like the popover: above the chip, flipping below when the top of
 * the viewport is closer than the card is tall.
 */
function Добавить реакциюionTooltip({
  anchor,
  emoji,
  names,
  label
}: {
  anchor: Добавить реакцию.RefObject<HTMLButtonElement | null>;
  emoji: string;
  names: string;
  label: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    const trigger = anchor.current;
    const card = cardRef.current;
    if (!trigger || !card) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const margin = 8;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const flip = rect.top - gap - margin < height;
    setPosition({
      top: flip ? rect.bottom + gap : rect.top - gap - height,
      left: Math.max(
        margin,
        Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - margin)
      )
    });
  }, [anchor, names]);

  return createPortal(
    <div className="reaction-tooltip" role="tooltip" ref={cardRef} style={position}>
      <span className="reaction-tooltip-emoji">
        <ЭмодзиValue value={emoji} />
      </span>
      <p>
        <strong>{names}</strong> reacted with <span className="reaction-tooltip-name">{label}</span>
      </p>
    </div>,
    document.body
  );
}

/** Hover-toolbar shortcuts, learned from what this user actually reaches for. */
export function QuickДобавить реакциюions({ message }: { message: СообщениеDto }) {
  const { actions } = useApp();
  // The frequency list lives in localStorage, so it is read after mount to keep
  // the server and client renders identical.
  const [emoji, setЭмодзи] = useState<string[]>([]);
  useEffect(() => setЭмодзи(reactionShortcuts()), []);

  return (
    <>
      {emoji.map((value) => (
        <button
          key={value}
          type="button"
          title={`Добавить реакцию with ${emojiLabel(value)}`}
          onClick={() => {
            rememberЭмодзи(value);
            void actions.toggleДобавить реакциюion(message, value);
          }}
        >
          <ЭмодзиValue value={value} />
        </button>
      ))}
    </>
  );
}
