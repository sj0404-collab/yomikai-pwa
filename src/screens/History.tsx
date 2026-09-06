import React, { useSyncExternalStore } from "react";
import { getState, subscribe, setState, type LibItem } from "../store";

export default function History({ onOpen }: { onOpen: (it: LibItem) => void }) {
  const s = useSyncExternalStore(subscribe, getState);
  return (
    <>
      <div className="topbar">
        <h1>История</h1>
        {s.history.length > 0 && (
          <button className="btn ghost" onClick={() => setState((st) => (st.history = []))}>
            Очистить
          </button>
        )}
      </div>
      <div className="screen">
        {s.history.length === 0 && <div className="panel muted">Пока пусто — откройте что-нибудь в библиотеке или каталогах.</div>}
        {s.history.map((h, i) => {
          const item = s.library.find((l) => l.title === h.title);
          return (
            <div key={i} className="list-item" style={{ cursor: item ? "pointer" : undefined }} onClick={() => item && onOpen(item)}>
              <div className="grow">
                <div className="t">{h.title}</div>
                <div className="muted">
                  {new Date(h.at).toLocaleString("ru-RU")} · {h.note}
                </div>
              </div>
              {item && <span className="badge">открыть</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
