import React, { useState, useSyncExternalStore } from "react";
import { mount } from "./mount";
import { getState, subscribe, type LibItem } from "../store";
import { param } from "../Shell";
import Reader from "../reader/Reader";

// PWA «Читалка»: тайтл берётся из ?open=<id> (его передаёт Kotlin-обёртка
// или соседняя PWA), иначе — выбор из библиотеки.
function Root() {
  const [id, setId] = useState<string | null>(param("open"));
  const s = useSyncExternalStore(subscribe, getState);
  const item: LibItem | null = s.library.find((l) => l.id === id) ?? null;
  if (!item) {
    return (
      <div className="screen">
        <div className="topbar">
          <h1>Читалка</h1>
        </div>
        <div className="panel muted">Выберите тайтл:</div>
        {s.library.map((l) => (
          <div key={l.id} className="list-item" style={{ cursor: "pointer" }} onClick={() => setId(l.id)}>
            <div className="grow">
              <div className="t">{l.title}</div>
              <div className="muted">{l.source} · {l.pages.length} стр.</div>
            </div>
            <span className="badge">открыть</span>
          </div>
        ))}
      </div>
    );
  }
  return <Reader item={item} />;
}
mount("reader", <Root />);
