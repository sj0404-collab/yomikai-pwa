import React, { useSyncExternalStore } from "react";
import { getState, subscribe, setState, addHistory, type LibItem } from "../store";

export default function Library({ onOpen }: { onOpen: (it: LibItem) => void }) {
  const s = useSyncExternalStore(subscribe, getState);
  return (
    <>
      <div className="topbar">
        <h1>Библиотека</h1>
        <span className="muted">{s.library.length}</span>
      </div>
      <div className="screen">
        {s.library.length === 0 && (
          <div className="panel muted">
            Пусто. Добавьте тайтлы во вкладке «Каталоги» или «Локальное» (Ещё → Локальное: по URL картинок).
          </div>
        )}
        <div className="grid">
          {s.library.map((it) => (
            <button
              key={it.id}
              className="card"
              onClick={() => {
                addHistory(it.title, `стр. ${it.lastPage + 1}/${it.pages.length}`);
                onOpen(it);
              }}
            >
              <img src={it.cover} alt="" loading="lazy" />
              <div className="t">{it.title}</div>
              <div className="s">
                {it.source} · {it.lastPage + 1}/{it.pages.length}
              </div>
            </button>
          ))}
        </div>
        <div className="hr" />
        <button
          className="btn ghost"
          onClick={() => {
            const title = prompt("Название нового тайтла (страницы добавите через URL картинок):");
            if (!title) return;
            setState((st) => {
              st.library = [
                {
                  id: "u" + Date.now(),
                  title,
                  source: "Локальное",
                  cover: "",
                  pages: [],
                  lastPage: 0,
                  updatedAt: Date.now(),
                },
                ...st.library,
              ];
            });
          }}
        >
          ＋ Добавить тайтл
        </button>
      </div>
    </>
  );
}
