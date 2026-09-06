// Общее состояние PWA: всё в localStorage, переживает перезапуск.
export type LibItem = {
  id: string;
  title: string;
  source: string;
  cover: string;
  pages: { img: string; text: string }[];
  lastPage: number;
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

/** Демо-страница: SVG-«страница манги» с репликами (data-URI, работает офлайн). */
export function makePage(title: string, lines: string[], n: number): { img: string; text: string } {
  const bubbles = lines
    .map((t, i) => {
      const x = 30 + (i % 2) * 220;
      const y = 40 + Math.floor(i / 2) * 150;
      const safe = t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return `<rect x="${x}" y="${y}" rx="18" width="230" height="110" fill="#ffffff" stroke="#222" stroke-width="3"/>
      <foreignObject x="${x + 12}" y="${y + 10}" width="206" height="90">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font:600 17px/1.25 sans-serif;color:#111">${safe}</div>
      </foreignObject>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="${Math.max(360, 60 + Math.ceil(lines.length / 2) * 150 + 40)}">
    <rect width="100%" height="100%" fill="#e8e2d6"/>
    <rect x="14" y="14" width="492" height="${Math.max(330, Math.ceil(lines.length / 2) * 150 + 10)}" fill="#f6f2e9" stroke="#8a8375" stroke-width="2"/>
    <text x="26" y="${Math.max(360, 60 + Math.ceil(lines.length / 2) * 150 + 20)}" font-size="14" fill="#6b6455" font-family="sans-serif">${title} — стр. ${n}</text>
    ${bubbles}
  </svg>`;
  return { img: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), text: lines.join(" ") };
}

function seed(): Store {
  const demo1: LibItem = {
    id: "demo-mech",
    title: "Клинок Рассвета (демо)",
    source: "Локальное демо",
    cover: makePage("Клинок Рассвета", ["Меч снова пел.", "А ты слышишь?"], 1).img,
    pages: [
      makePage("Клинок Рассвета", ["Меч снова пел.", "А ты слышишь?"], 1),
      makePage("Клинок Рассвета", ["Пять йен за душу — дорого.", "Бери две, уступлю."], 2),
      makePage("Клинок Рассвета", ["Рассвет пришёл без спроса.", "Как и все хорошие вещи."], 3),
    ],
    lastPage: 0,
    updatedAt: Date.now(),
  };
  const demo2: LibItem = {
    id: "demo-osfera",
    title: "Осфера (демо)",
    source: "Локальное демо",
    cover: makePage("Осфера", ["Атмосфера дрогнула.", "Они уже здесь."], 1).img,
    pages: [
      makePage("Осфера", ["Атмосфера дрогнула.", "Они уже здесь."], 1),
      makePage("Осфера", ["Дыши глубже, сестра.", "Воздух — тоже оружие."], 2),
    ],
    lastPage: 0,
    updatedAt: Date.now() - 86400000,
  };
  return {
    library: [demo1, demo2],
    history: [],
    settings: { theme: "dark", rate: 1, pitch: 1, voiceURI: "", readerMode: "vertical" },
  };
}

let state: Store = load();
const listeners = new Set<() => void>();

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && Array.isArray(s.library) && s.settings) return s;
    }
  } catch {
    /* повреждённое хранилище — начинаем с сида */
  }
  return seed();
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
    s.history = [{ title, at: Date.now(), note }, ...s.history.filter((h) => h.title !== title || h.note !== note)].slice(0, 200);
  });
}
export function resetAll() {
  localStorage.removeItem(KEY);
  state = load();
  listeners.forEach((f) => f());
}
export { seed };
