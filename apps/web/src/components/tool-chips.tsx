"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { PROJECT_LIMITS, PROJECT_TOOLS } from "@/lib/schemas/project";
import { Button } from "./button";
import { Input } from "./field";
import { FilterChip } from "./filter-chip";

/**
 * "Unelte folosite": the fixed chips, then any added with "+ Alta", in a
 * multi-select. The value keeps the order they were picked in, since cards
 * show the first two.
 */
export function ToolChips({
  value,
  onChange,
  firstRef,
}: {
  value: string[];
  onChange: (tools: string[]) => void;
  firstRef: React.Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("launch.tools");
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const otherButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const custom = value.filter((tool) => !PROJECT_TOOLS.includes(tool));
  const toggle = (tool: string) =>
    onChange(
      value.includes(tool) ? value.filter((t) => t !== tool) : [...value, tool],
    );

  const close = () => {
    setAdding(false);
    setDraft("");
    // The button comes back on the next render.
    requestAnimationFrame(() => otherButton.current?.focus());
  };

  const addOther = () => {
    const tool = draft.trim().replace(/\s+/g, " ");
    if (tool) {
      // "claude" is Claude.
      const known = [...PROJECT_TOOLS, ...value].find(
        (t) => t.toLowerCase() === tool.toLowerCase(),
      );
      const name = known ?? tool;
      if (!value.includes(name)) onChange([...value, name]);
    }
    close();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {[...PROJECT_TOOLS, ...custom].map((tool, index) => (
        <FilterChip
          key={tool}
          ref={index === 0 ? firstRef : undefined}
          type="button"
          selected={value.includes(tool)}
          onClick={() => toggle(tool)}
        >
          <span className="min-w-0 truncate">{tool}</span>
        </FilterChip>
      ))}
      {adding ? (
        <div className="flex w-full flex-wrap items-center gap-2">
          <label htmlFor={`${id}-other`} className="sr-only">
            {t("otherLabel")}
          </label>
          <Input
            ref={input}
            id={`${id}-other`}
            type="text"
            autoFocus
            maxLength={PROJECT_LIMITS.tool}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter adds the tool; it mustn't submit the form.
              if (event.key === "Enter") {
                event.preventDefault();
                addOther();
              } else if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
            className="min-h-11 w-auto min-w-0 flex-[1_1_180px]"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addOther}
          >
            {t("otherAdd")}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={close}>
            {t("otherCancel")}
          </Button>
        </div>
      ) : (
        <FilterChip
          ref={otherButton}
          type="button"
          onClick={() => setAdding(true)}
        >
          {t("other")}
        </FilterChip>
      )}
    </div>
  );
}
