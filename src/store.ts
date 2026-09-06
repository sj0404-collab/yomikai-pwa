// Общее состояние PWA: всё в localStorage, переживает перезапуск.
// Заглушек/демо нет: библиотека — реальные тайтлы (из источников обёртки или
// добавленные вручную по URL картинок), история — реальные прочтения.
export type LibItem = {
  id: string;
  title: string;
  source: string;
  cover: string;
  // удалённый тайтл из источника (движок расширений обёртки)
  srcId?: string;
  mangaUrl?: string;
  referer?: string;
  // локальный тайтл: страницы-картинки
  pages: { img: string; text: string }[];
  lastPage: number;
  lastChapter?: string;
  updatedAt: number;
};
export type HistItem = { title: string; at: number; note: string };
export type Settings = {
  theme: "dark" | "light";
  rate: number; // множитель скорости TTS
  pitch: number;
  voiceURI: string; // выбранный голос Web Speech ("" = авто ru)
  readerMode: "rtl" | "ltr" | "vertical";
};

const KEY = "yomikai-pwa-v1";

type Store = {
  library: LibItem[];
  history: HistItem[];
  settings: Settings;
};

function emptyStore(): Store {
  return {
    library: [],
    history: [],
    settings: { theme: "dark", rate: 1, pitch: 1, voiceURI: "", readerMode: "vertical" },
  };
}

let state: Store = load();
const listeners = new Set<() => void>();

function load(): Store {
  const base = emptyStore();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && Array.isArray(s.library) && s.settings) {
        // миграция: выбрасываем старые демо-записи, нормализуем поля
        s.library = s.library
          .filter((it) => it && !String(it.id).startsWith("demo-") && !/\(демо\)/.test(it.title || ""))
          .map((it) => ({ ...it, pages: Array.isArray(it.pages) ? it.pages : [] }));
        s.history = Array.isArray(s.history) ? s.history : [];
        return { ...base, ...s };
      }
    }
  } catch {
    /* повреждённое хранилище — начинаем с чистого */
  }
  return base;
}

export function getState(): Store {
  return state;
}
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setState(mut: (s: Store) => void) {
  mut(state);
  // Новый верхнеуровневый объект: useSyncExternalStore сравнивает снапшот по
  // ссылке — без этого React не узнает об изменении.
  state = { ...state };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* переполнение localStorage — не роняем приложение */
  }
  listeners.forEach((f) => f());
}
export function addHistory(title: string, note: string) {
  setState((s) => {
    s.history = [{ title, at: Date.now(), note }, ...s.history.filter((h) => !(h.title === title && h.note === note))].slice(0, 200);
  });
}
export function upsertLib(item: LibItem) {
  setState((s) => {
    const i = s.library.findIndex((l) => l.id === item.id);
    if (i >= 0) s.library[i] = { ...s.library[i], ...item };
    else s.library = [item, ...s.library];
  });
}
export function resetAll() {
  localStorage.removeItem(KEY);
  state = load();
  listeners.forEach((f) => f());
}
