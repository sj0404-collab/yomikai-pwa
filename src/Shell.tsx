// Оболочка-мост: детект «внутри Kotlin-обёртки», переходы между PWA-вкладками,
// параметры URL. В браузере (standalone) показывает нижние ссылки-вкладки.
import React, { useEffect, useSyncExternalStore } from "react";
import { getState, subscribe } from "./store";
import { loadTabsCfg, TAB_META, type TabId } from "./tabs";

export type { TabId };
export const TABS: TabId[] = ["library", "browse", "history", "reader", "web", "ai", "more"];

/** Работаем внутри Kotlin-обёртки (её WebView инжектит AndroidShell). */
export function embedded(): boolean {
  return typeof (window as any).AndroidShell !== "undefined" || location.search.includes("shell=1");
}
export function param(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}
/** Переход на вкладку: в обёртке — нативный таб Kotlin, в браузере — ссылка на соседнюю PWA. */
export function goto(tab: TabId, params?: Record<string, string>) {
  const q = params && Object.keys(params).length ? "?" + new URLSearchParams(params).toString() : "";
  const shell = (window as any).AndroidShell;
  if (shell?.openTab) {
    shell.openTab(tab, q);
    return;
  }
  location.href = "../" + tab + "/" + q;
}

/** Общая рамка PWA-вкладки: контент + (в браузере) нижние ссылки на соседние PWA. */
export function Frame({ tab, children }: { tab: TabId; children: React.ReactNode }) {
  const store = useSyncExternalStore(subscribe, getState);
  useEffect(() => {
    document.documentElement.dataset.theme = store.settings.theme;
  }, [store.settings.theme]);
  const cfg = loadTabsCfg();
  const visible = cfg.order.filter((t) => !cfg.hidden.includes(t) && TABS.includes(t));
  return (
    <div className="app">
      {children}
      {!embedded() && (
        <nav className="tabs">
          {visible.map((t) => (
            <a key={t} className={"tab" + (tab === t ? " active" : "")} href={"../" + t + "/"}>
              <span className="ico">{TAB_META[t].ico}</span>
              <span className="lbl">{TAB_META[t].label}</span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
