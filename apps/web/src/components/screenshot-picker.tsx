"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { UploadAnswer } from "@/app/api/capturi/route";
import { cn } from "@/lib/utils";

/** HANDOVER §6 09; the server checks them again (/api/capturi). */
const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX = 4;
/** A touch must rest this long before it drags, so a swipe still scrolls. */
const HOLD_MS = 250;

export type UploadError = "type" | "too_large" | "unavailable" | "failed";

async function upload(file: File): Promise<UploadAnswer> {
  const body = new FormData();
  body.set("file", file);
  try {
    const response = await fetch("/api/capturi", { method: "POST", body });
    return (await response.json()) as UploadAnswer;
  } catch {
    return { ok: false, reason: "failed" };
  }
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
};

/**
 * "Capturi de ecran" (screen 09): 2–4 tiles, the first is the thumbnail.
 * Reorder by dragging (mouse at once, touch after a short hold) or, focused,
 * with the arrow keys; each move is announced. Uploads go through
 * /api/capturi, which resizes to webp on the server.
 */
export function ScreenshotPicker({
  value,
  onChange,
  onUploadError,
  addRef,
  labelId,
  describedBy,
  invalid,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  /** Null clears it. */
  onUploadError: (error: UploadError | null) => void;
  /** For the form: the first invalid field gets the focus. */
  addRef: React.Ref<HTMLButtonElement>;
  labelId: string;
  describedBy: string;
  invalid: boolean;
}) {
  const t = useTranslations("launch.screenshots");
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const tiles = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement | null>(null);
  // The latest list, for uploads that finish after a reorder or a removal.
  const latest = useRef(value);
  latest.current = value;
  const [pending, setPending] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [focusAfter, setFocusAfter] = useState<string | null>(null);
  const drag = useRef<{
    url: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    timer: number | null;
    /** Each slot's box when the drag started; the grid's slots don't move. */
    slots: DOMRect[];
  } | null>(null);
  const list = useRef<HTMLUListElement>(null);

  // Focus follows a tile after a keyboard move or a removal, once rendered.
  useEffect(() => {
    if (!focusAfter) return;
    (focusAfter === "add"
      ? addButton.current
      : tiles.current.get(focusAfter)
    )?.focus();
    setFocusAfter(null);
  }, [focusAfter, value]);

  // While a touch drags, the page mustn't scroll. Only a non-passive listener
  // can stop that, and React's are passive.
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const stop = (event: TouchEvent) => {
      if (drag.current?.active) event.preventDefault();
    };
    element.addEventListener("touchmove", stop, { passive: false });
    return () => element.removeEventListener("touchmove", stop);
  }, []);

  const free = MAX - value.length - pending;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    onUploadError(null);
    const picked = [...files].slice(0, Math.max(free, 0));
    for (const file of picked) {
      if (!TYPES.includes(file.type)) return onUploadError("type");
      if (file.size > MAX_BYTES) return onUploadError("too_large");
    }
    setPending((n) => n + picked.length);
    for (const file of picked) {
      const answer = await upload(file);
      setPending((n) => n - 1);
      if (answer.ok) {
        onChange([...latest.current, answer.url]);
        setAnnouncement(t("added"));
      } else {
        onUploadError(
          answer.reason === "signed_out" ? "failed" : answer.reason,
        );
      }
    }
  };

  const reorder = (from: number, to: number, announce: boolean) => {
    if (to < 0 || to >= value.length || to === from) return;
    onChange(move(value, from, to));
    if (announce) {
      setAnnouncement(t("moved", { n: to + 1, total: value.length }));
    }
  };

  const remove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    setAnnouncement(t("removed"));
    setFocusAfter(next[Math.min(index, next.length - 1)] ?? "add");
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const to = {
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      Home: 0,
      End: value.length - 1,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const url = value[index]!;
    reorder(index, Math.min(Math.max(to, 0), value.length - 1), true);
    setFocusAfter(url);
  };

  const start = (url: string) => {
    const current = drag.current;
    if (!current || current.url !== url) return;
    current.active = true;
    current.slots = [...(list.current?.children ?? [])]
      .slice(0, latest.current.length)
      .map((slot) => slot.getBoundingClientRect());
    setDragging(url);
  };

  const onPointerDown = (event: React.PointerEvent, url: string) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      url,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      timer:
        event.pointerType === "mouse"
          ? null
          : window.setTimeout(() => start(url), HOLD_MS),
      slots: [],
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const moved = Math.hypot(
      event.clientX - current.startX,
      event.clientY - current.startY,
    );
    if (!current.active) {
      if (event.pointerType === "mouse" && moved > 4) start(current.url);
      // A touch that moves before the hold is a scroll, not a drag.
      else if (event.pointerType !== "mouse" && moved > 8) end();
      return;
    }
    const to = current.slots.findIndex(
      (box) =>
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom,
    );
    const from = latest.current.indexOf(current.url);
    if (to !== -1 && from !== -1 && to !== from) {
      onChange(move(latest.current, from, to));
    }
  };

  const end = () => {
    const current = drag.current;
    if (current?.timer) window.clearTimeout(current.timer);
    if (current?.active) {
      const n = latest.current.indexOf(current.url) + 1;
      setAnnouncement(t("moved", { n, total: latest.current.length }));
    }
    drag.current = null;
    setDragging(null);
  };

  return (
    <>
      <ul
        ref={list}
        aria-labelledby={labelId}
        className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3.5"
      >
        {value.map((url, index) => (
          <li key={url} className="relative">
            <button
              type="button"
              ref={(element) => {
                if (element) tiles.current.set(url, element);
                else tiles.current.delete(url);
              }}
              aria-label={t(index === 0 ? "tileFirst" : "tile", {
                n: index + 1,
                total: value.length,
              })}
              aria-describedby={`${id}-move`}
              onKeyDown={(event) => onKeyDown(event, index)}
              onPointerDown={(event) => onPointerDown(event, url)}
              onPointerMove={onPointerMove}
              onPointerUp={end}
              onPointerCancel={end}
              onContextMenu={(event) => event.preventDefault()}
              className={cn(
                "block h-[84px] w-full cursor-grab select-none overflow-hidden rounded-[8px] bg-tint [-webkit-touch-callout:none]",
                dragging === url && "cursor-grabbing opacity-60",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- already resized webp */}
              <img
                src={url}
                alt=""
                draggable={false}
                className="size-full object-cover"
              />
            </button>
            <button
              type="button"
              aria-label={t("remove", { n: index + 1 })}
              onClick={() => remove(index)}
              // 28px as drawn; the ::before stretches the target to 44px.
              className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border border-border bg-surface text-ink before:absolute before:-inset-2 before:content-[''] hover:bg-tint"
            >
              <X size={16} strokeWidth={2.2} aria-hidden />
            </button>
          </li>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <li
            key={`pending-${i}`}
            className="flex h-[84px] items-center justify-center rounded-[8px] bg-tint text-sm font-semibold text-muted"
          >
            {t("uploading")}
          </li>
        ))}
        {free > 0 && (
          <li>
            <button
              type="button"
              ref={(element) => {
                addButton.current = element;
                if (typeof addRef === "function") addRef(element);
                else if (addRef) addRef.current = element;
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onClick={() => fileInput.current?.click()}
              className={cn(
                "flex h-[84px] w-full flex-col items-center justify-center gap-1 rounded-[8px] border-2 border-dashed border-border text-sm font-semibold text-ink hover:bg-tint",
                invalid && "border-warning-ink",
              )}
            >
              <Plus size={18} strokeWidth={2.2} aria-hidden />
              {t("add")}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={fileInput}
        type="file"
        accept={TYPES.join(",")}
        multiple
        hidden
        onChange={(event) => {
          void add(event.target.files);
          event.target.value = "";
        }}
      />
      <span id={`${id}-move`} hidden>
        {t("moveHint")}
      </span>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
