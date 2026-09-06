import React, { useEffect, useState, useSyncExternalStore } from "react";
import { getState, subscribe, type LibItem } from "./store";
import { loadTabsCfg, saveTabsCfg, type TabId, type TabsCfg } from "./tabs";
import Library from "./screens/Library";
import History from "./screens/History";
import Browse from "./screens/Browse";
import Reader from "./reader/Reader";
import WebTab from "./screens/WebTab";
import AiChat from "./screens/AiChat";
import More from "./screens/More";

export default function App() {
  const store = useSyncExternalStore(subscribe, getState);
  const [tab, setTab] = useState<TabId>("library");
  const [current, setCurrent] = useState<LibItem | null>(null);
  const [cfg, setCfg] = useState<TabsCfg>(loadTabsCfg);

  useEffect(() => {
    document.documentElement.dataset.theme = store.settings.theme;
  }, [store.settings.theme]);

  const openItem = (it: LibItem) => {
    setCurrent(it);
    setTab("reader");
  };
  const visible = cfg.order.filter((t) => !cfg.hidden.includes(t));

  return (
    <div className="app">
      {tab === "library" && <Library onOpen={openItem} />}
      {tab === "history" && <History onOpen={openItem} />}
      {tab === "browse" && <Browse onOpen={openItem} goWeb={() => setTab("web")} />}
      {tab === "reader" && <Reader item={current} />}
      {tab === "web" && <WebTab />}
      {tab === "ai" && <AiChat />}
      {tab === "more" && (
        <More
          cfg={cfg}
          setCfg={(c) => {
            setCfg(c);
            saveTabsCfg(c);
          }}
        />
      )}
      <nav className="tabs">
        {visible.map((t) => (
          <button key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
            <span className="ico">{TAB_ICO[t]}</span>
            <span className="lbl">{TAB_LBL[t]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

import { TAB_META } from "./tabs";
const TAB_ICO: Record<string, string> = Object.fromEntries(Object.entries(TAB_META).map(([k, v]) => [k, v.ico]));
const TAB_LBL: Record<string, string> = Object.fromEntries(Object.entries(TAB_META).map(([k, v]) => [k, v.label]));
