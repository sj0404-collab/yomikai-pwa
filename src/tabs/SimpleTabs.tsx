import React, { useState } from "react";
import { getState, setState, useStore, LibraryItem } from "../store";
import { AppBar, Row, Toggle } from "../ui";

/** Демо-данные библиотеки/обновлений/истории — как заготовки в Android-версии. */
export function LibraryTab(props: { onOpen: (id: string) => void; showToast: (t: string) => void }) {
  const state = useStore();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <>
      <AppBar
        title="Библиотека"
        right={<button className="sfab" onClick={() => setAdding((v) => !v)}>＋</button>}
      />
      {adding && (
        <div className="card">
          <input className="input" placeholder="Название манги" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              className="chip on"
              onClick={() => {
                if (!title.trim()) return;
                const item: LibraryItem = {
                  id: "m" + Date.now(),
                  title: title.trim(),
                  author: "Добавлено вручную",
                  color: "#4f7cff",
                  pages: 3,
                };
                setState({ library: [...getState().library, item] });
                setTitle("");
                setAdding(false);
                props.showToast("Добавлено в библиотеку");
              }}
            >
              Добавить
            </button>
          </div>
        </div>
      )}
      {state.library.map((m) => (
        <Row key={m.id} title={m.title} subtitle={m.author} onClick={() => props.onOpen(m.id)} />
      ))}
      {state.library.length === 0 && <div className="card muted">Библиотека пуста. Добавьте первую мангу.</div>}
    </>
  );
}

export function LocalTab() {
  return (
    <>
      <AppBar title="Локальное" />
      <div className="card muted">
        Локальные файлы в PWA хранятся в IndexedDB браузера. Демо-версия показывает структуру вкладки;
        загрузка CBZ/ZIP появится следующим проходом.
      </div>
    </>
  );
}

export function UpdatesTab() {
  const state = useStore();
  return (
    <>
      <AppBar title="Обновления" />
      {state.library.slice(0, 2).map((m) => (
        <Row key={m.id} title={m.title} subtitle="Глава 12 · сегодня" />
      ))}
    </>
  );
}

export function HistoryTab(props: { onOpen: (id: string) => void }) {
  const state = useStore();
  return (
    <>
      <AppBar title="История" />
      {state.history.length === 0 && <div className="card muted">История пуста: откройте что-нибудь из библиотеки.</div>}
      {state.history.map((h) => (
        <Row
          key={h.id + h.at}
          title={h.title}
          subtitle={new Date(h.at).toLocaleString("ru-RU")}
          onClick={() => props.onOpen(h.id)}
        />
      ))}
    </>
  );
}

export function BrowseTab(props: { showToast: (t: string) => void }) {
  const sources = [
    { name: "MangaBuff (демо-заглушка)", lang: "ru" },
    { name: "Локальный каталог OPDS", lang: "any" },
  ];
  return (
    <>
      <AppBar title="Каталоги" />
      {sources.map((s) => (
        <Row
          key={s.name}
          title={s.name}
          subtitle={`Язык: ${s.lang}`}
          onClick={() => props.showToast("Источник-заглушка: расширения источников в PWA появятся следующим проходом")}
        />
      ))}
      <div className="card muted">
        Лента обновлений источников (как в TachiyomiSY) в PWA появится вместе с реальными расширениями.
      </div>
    </>
  );
}
