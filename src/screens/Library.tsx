import React, { useState, useSyncExternalStore } from "react";
import { getState, subscribe, setState, addHistory, upsertLib, type LibItem } from "../store";
import { goto } from "../Shell";
import { srcBridge, jp, proxyUrl, type ChInfo } from "../bridge";

// Библиотека: реальные тайтлы — добавленные из каталога (источники-расширения
// обёртки) или локальные (страницы по URL картинок). Никаких демо-записей.
export default function Library({ onOpen }: { onOpen: (it: LibItem) => void }) {
  const s = useSyncExternalStore(subscribe, getState);
  const [sheet, setSheet] = useState<{ item: LibItem; chapters: ChInfo[]; err: string; loading: boolean } | null>(null);

  const open = (it: LibItem) => {
    if (it.srcId && it.mangaUrl && srcBridge) {
      // удалённый тайтл: свежие главы из источника
      setSheet({ item: it, chapters: [], err: "", loading: true });
      try {
        const ch = jp<ChInfo[] | { error?: string }>(srcBridge.chapters(it.srcId, it.mangaUrl, it.title));
        if (Array.isArray(ch)) setSheet({ item: it, chapters: ch, err: "", loading: false });
        else setSheet({ item: it, chapters: [], err: (ch as any).error || "Ошибка", loading: false });
      } catch (e: any) {
        setSheet({ item: it, chapters: [], err: String(e?.message || e), loading: false });
      }
      return;
    }
    addHistory(it.title, it.pages.length ? `стр. ${it.lastPage + 1}/${it.pages.length}` : "открыто");
    onOpen(it);
  };

  const openChapter = (it: LibItem, ch: ChInfo) => {
    addHistory(`${it.title} · ${ch.name}`, "чтение главы");
    upsertLib({ ...it, lastChapter: ch.name });
    goto("reader", { src: it.srcId!, mt: it.title, mu: it.mangaUrl!, cn: ch.name, cu: ch.url });
  };

  return (
    <>
      <div className="topbar">
        <h1>Библиотека</h1>
        <span className="muted">{s.library.length}</span>
      </div>
      <div className="screen">
        {s.library.length === 0 && (
          <div className="panel muted">
            Пусто. Добавьте тайтлы во вкладке «Каталоги» (кнопка «＋ В библиотеку» на странице тайтла)
            или создайте локальный тайтл внизу.
          </div>
        )}
        <div className="grid">
          {s.library.map((it) => (
            <button key={it.id} className="card" onClick={() => open(it)}>
              {it.cover ? (
                <img src={it.cover} alt="" loading="lazy" crossOrigin={it.cover.startsWith("http://127.0.0.1") ? "anonymous" : undefined} />
              ) : (
                <div className="cover-ph" />
              )}
              <div className="t">{it.title}</div>
              <div className="s">
                {it.source}
                {it.lastChapter ? ` · ${it.lastChapter}` : it.pages.length ? ` · стр. ${it.lastPage + 1}/${it.pages.length}` : ""}
              </div>
            </button>
          ))}
        </div>
        <div className="hr" />
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn ghost grow"
            onClick={() => {
              const title = prompt("Название нового тайтла (страницы добавите через URL картинок):");
              if (!title) return;
              upsertLib({ id: "u" + Date.now(), title, source: "Локальное", cover: "", pages: [], lastPage: 0, updatedAt: Date.now() });
            }}
          >
            ＋ Локальный тайтл
          </button>
        </div>
        {sheet && (
          <div className="sheet-back" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="topbar">
                <h1>{sheet.item.title}</h1>
                <button className="btn ghost" onClick={() => setSheet(null)}>✕</button>
              </div>
              {sheet.loading && <div className="panel muted">Загружаем главы…</div>}
              {sheet.err && <div className="panel muted">Главы: {sheet.err}</div>}
              {sheet.chapters.map((ch) => (
                <div
                  key={ch.url + ch.name}
                  className="list-item"
                  style={{ cursor: "pointer", opacity: ch.name === sheet.item.lastChapter ? 0.6 : 1 }}
                  onClick={() => openChapter(sheet.item, ch)}
                >
                  <div className="grow">
                    <div className="t">{ch.name}</div>
                    <div className="muted">{ch.date ? new Date(ch.date).toLocaleDateString("ru-RU") : ""}{ch.scan ? ` · ${ch.scan}` : ""}</div>
                  </div>
                  <span className="badge">читать</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
