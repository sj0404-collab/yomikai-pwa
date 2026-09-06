import React, { useSyncExternalStore } from "react";
import { getState, subscribe, setState, addHistory, makePage, type LibItem } from "../store";

// Демо-каталоги: источники-заглушки (расширений-плагинов в вебе нет).
// «Установленный» источник добавляет демо-тайтл в библиотеку.
const SOURCES = [
  { id: "mangabuff", name: "Mangabuff (демо)", lang: "RU", url: "https://mangabuff.ru/" },
  { id: "remanga", name: "Remanga (демо)", lang: "RU", url: "https://remanga.org/" },
  { id: "mangalib", name: "MangaLib (демо)", lang: "RU", url: "https://mangalib.me/" },
  { id: "readmanga", name: "ReadManga (демо)", lang: "RU", url: "https://readmanga.io/" },
  { id: "anilibria", name: "AniLibria (демо)", lang: "RU", url: "https://anilibria.tv/" },
];

function demoTitle(srcName: string): LibItem {
  const n = Math.floor(Math.random() * 900) + 100;
  return {
    id: "cat" + Date.now() + n,
    title: `${srcName} · тайтл ${n} (демо)`,
    source: srcName,
    cover: makePage("Демо", ["Это демо-страница каталога.", "В вебе нет APK-расширений."], 1).img,
    pages: [
      makePage("Демо", ["Это демо-страница каталога.", "В вебе нет APK-расширений."], 1),
      makePage("Демо", ["Зато PWA весит килобайты,", "а не 40 мегабайт."], 2),
    ],
    lastPage: 0,
    updatedAt: Date.now(),
  };
}

export default function Browse({ onOpen, goWeb }: { onOpen: (it: LibItem) => void; goWeb: (url: string) => void }) {
  useSyncExternalStore(subscribe, getState);
  return (
    <>
      <div className="topbar">
        <h1>Каталоги</h1>
      </div>
      <div className="screen">
        <div className="panel muted">
          Расширения-источники (APK-плагины) в браузере недоступны. Каталоги здесь — демо-заглушки:
          «Открыть сайт» ведёт во вкладку Браузер, «Демо-тайтл» добавляет пример в библиотеку.
        </div>
        {SOURCES.map((s) => (
          <div key={s.id} className="list-item">
            <div className="grow">
              <div className="t">{s.name}</div>
              <div className="muted">{s.lang} · {s.url}</div>
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                const it = demoTitle(s.name);
                setState((st) => (st.library = [it, ...st.library]));
                addHistory(it.title, "добавлено из каталога");
                onOpen(it);
              }}
            >
              Демо-тайтл
            </button>
            <button className="btn" onClick={() => goWeb(s.url)}>
              Открыть сайт
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
