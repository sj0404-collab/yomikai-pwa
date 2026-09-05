import { useSyncExternalStore } from "react";

/**
 * Хранилище состояния PWA (localStorage) — зеркало «Конструктора» Android-версии:
 * скрытые вкладки, порядок вкладок, скрытые модули панелей, свои кнопки,
 * пресеты голоса, тема, настройки AI.
 */
export type CustomAction = {
  id: string;
  title: string;
  placement: "floating_menu" | "ocr_card";
  effect: "theme" | "voice_preset" | "reader_dir" | "tts_stop";
  value: string;
};

export type LibraryItem = { id: string; title: string; author: string; color: string; pages: number };

export type State = {
  hiddenTabs: string[];
  tabOrder: string[];
  hiddenModules: string[];
  actions: CustomAction[];
  theme: "dark" | "light";
  voiceGender: "auto" | "male" | "female" | "neutral";
  voiceAge: "baby" | "child" | "teen" | "adult" | "elder";
  readerDir: "rtl" | "ltr" | "vertical";
  ai: { url: string; key: string; model: string };
  library: LibraryItem[];
  history: { id: string; title: string; at: number }[];
};

const KEY = "yomikai_pwa_state_v1";

export const TABS = [
  { id: "library", title: "Библиотека", pinned: true },
  { id: "local", title: "Локальное" },
  { id: "updates", title: "Обновления" },
  { id: "history", title: "История" },
  { id: "browse", title: "Каталоги" },
  { id: "browser", title: "Браузер" },
  { id: "ai", title: "AI-чат" },
  { id: "more", title: "Ещё", pinned: true },
] as const;

export const MODULES: { id: string; title: string }[] = [
  { id: "r_scan", title: "Читалка: строка «OCR скан»" },
  { id: "r_autoscroll", title: "Читалка: автопрокрутка" },
  { id: "r_autoread", title: "Читалка: прочитать страницу" },
  { id: "r_order", title: "Читалка: порядок чтения" },
  { id: "r_tts", title: "Читалка: озвучка (TTS)" },
  { id: "b_url", title: "Браузер: URL-бар" },
  { id: "b_frame", title: "Браузер: iframe страницы" },
];

const DEFAULT: State = {
  hiddenTabs: [],
  tabOrder: [],
  hiddenModules: [],
  actions: [],
  theme: "dark",
  voiceGender: "auto",
  voiceAge: "adult",
  readerDir: "rtl",
  ai: { url: "", key: "", model: "" },
  library: [
    { id: "m1", title: "Слёзы на увядшем цветке", author: "Манхва · Дзёсэй", color: "#7a5cff", pages: 3 },
    { id: "m2", title: "A Stepmother's Märchen", author: "Манхва · Драма", color: "#c2554f", pages: 3 },
  ],
  history: [],
};

let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

export function getState(): State {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  emit();
}

export function useStore(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function isTabHidden(id: string): boolean {
  const t = TABS.find((x) => x.id === id);
  return state.hiddenTabs.includes(id) && !(t && (t as any).pinned);
}

export function orderedTabs() {
  const visible = TABS.filter((t) => !isTabHidden(t.id));
  const order = state.tabOrder;
  if (!order.length) return visible;
  return [...visible].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

export function isModuleHidden(id: string): boolean {
  return state.hiddenModules.includes(id);
}

export function resetConstructor() {
  setState({ hiddenModules: [], tabOrder: [] });
}
