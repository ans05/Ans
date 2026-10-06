"use client";

import { useOptimistic, useTransition } from "react";

import type { ChecklistItem } from "@nimbus/core";

import { setChecklistItemAction } from "@/app/actions";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/Icon";

interface ChecklistProps {
  items: ChecklistItem[];
  groups: Array<{ title: string; itemIds: string[] }>;
}

export function Checklist({ items, groups }: ChecklistProps) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    items,
    (current, update: { id: string; done: boolean }) =>
      current.map((i) => (i.id === update.id ? { ...i, done: update.done } : i)),
  );
  const byId = new Map(optimistic.map((i) => [i.id, i]));

  const toggle = (id: string, done: boolean) =>
    startTransition(async () => {
      setOptimistic({ id, done });
      await setChecklistItemAction(id, done);
    });

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <Card key={group.title} as="section" aria-labelledby={`group-${slug(group.title)}`} padded={false} className="overflow-hidden">
          <h2 id={`group-${slug(group.title)}`} className="border-b border-line px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide text-ink-3 sm:px-5">
            {group.title}
          </h2>
          <ul>
            {group.itemIds.map((id) => {
              const item = byId.get(id);
              if (!item) return null;
              return (
                <li key={id} className="border-b border-line last:border-b-0">
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2 sm:px-5">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) => toggle(item.id, e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                        item.done ? "border-accent-ink bg-accent-ink text-canvas" : "border-line-2 bg-surface",
                      )}
                    >
                      {item.done ? <Icon name="check" size={12} /> : null}
                    </span>
                    <span className={cn("text-sm transition-colors duration-150", item.done ? "text-ink-3 line-through" : "text-ink")}>
                      {item.label}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
