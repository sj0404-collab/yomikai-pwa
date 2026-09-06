// Метаданные вкладок и конфигурация Конструктора (отдельный модуль — без циклов
// импортов между App и экранами).
export type TabId = "library" | "history" | "browse" | "reader" | "web" | "ai" | "more";

export const TAB_META: Record<TabId, { ico: string; label: string }> = {
  library: { ico: "📚", label: "Библиотека" },
  history: { ico: "🕘", label: "История" },
  browse: { ico: "🧭", label: "Каталоги" },
  reader: { ico: "📖", label: "Читалка" },
  web: { ico: "🌐", label: "Браузер" },
  ai: { ico: "🤖", label: "AI-чат" },
  more: { ico: "⚙️", label: "Ещё" },
};

export type CustomButton = { id: string; title: string; effect: string };
export type TabsCfg = { order: TabId[]; hidden: TabId[]; customButtons: CustomButton[] };
const TABS_KEY = "yomikai-pwa-tabs-v1";

function defaultTabsCfg(): TabsCfg {
  return {
    order: ["library", "browse", "history", "reader", "web", "ai", "more"],
    hidden: [],
    customButtons: [],
  };
}
export function loadTabsCfg(): TabsCfg {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (Array.isArray(c.order) && Array.isArray(c.hidden)) return { customButtons: [], ...c };
    }
  } catch {
    /* fallthrough */
  }
  return defaultTabsCfg();
}
export function saveTabsCfg(c: TabsCfg) {
  localStorage.setItem(TABS_KEY, JSON.stringify(c));
}
