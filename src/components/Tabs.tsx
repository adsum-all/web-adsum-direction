// Simple accessible tab bar. Uses the existing `.tabs` / `.tab` styles.
import { useState } from "react";
import type { ReactNode } from "react";

export interface TabDef { key: string; label: string; content: ReactNode; hint?: string }

export function Tabs({ tabs, initialKey, ariaLabel }: { tabs: TabDef[]; initialKey?: string; ariaLabel?: string }): JSX.Element {
  const [active, setActive] = useState<string>(initialKey ?? tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <>
      <div className="tabs" role="tablist" aria-label={ariaLabel ?? "Onglets"}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            className={`tab${t.key === active ? " is-active" : ""}`}
            onClick={() => setActive(t.key)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </>
  );
}
