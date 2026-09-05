import React, { useEffect, useState } from "react";
import { orderedTabs, useStore, setState, TABS } from "./store";
import { AppBar, ToastHost, useToast, Ic } from "./ui";
import { LibraryTab, LocalTab, UpdatesTab, HistoryTab, BrowseTab } from "./tabs/SimpleTabs";
import { BrowserTab } from "./tabs/BrowserTab";
import { AiChatTab } from "./tabs/AiChatTab";
import { MoreTab } from "./settings/Settings";
import { Reader } from "./reader/Reader";

export default function App() {
  const state = useStore();
  const [tab, setTab] = useState<string>("library");
  const [readerItem, setReaderItem] = useState<string | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  // Если текущую вкладку скрыли конструктором — возвращаемся в библиотеку.
  useEffect(() => {
    if (!orderedTabs().some((t) => t.id === tab)) setTab("library");
  }, [state.hiddenTabs, state.tabOrder]);

  if (readerItem) {
    const item = state.library.find((l) => l.id === readerItem);
    return (
      <Reader
        title={item?.title ?? "Чтение"}
        pages={item?.pages ?? 3}
        onExit={() => setReaderItem(null)}
        showToast={showToast}
      />
    );
  }

  const tabs = orderedTabs();
  const content =
    tab === "library" ? <LibraryTab onOpen={(id) => setReaderItem(id)} showToast={showToast} /> :
    tab === "local" ? <LocalTab /> :
    tab === "updates" ? <UpdatesTab /> :
    tab === "history" ? <HistoryTab onOpen={(id) => setReaderItem(id)} /> :
    tab === "browse" ? <BrowseTab showToast={showToast} /> :
    tab === "browser" ? <BrowserTab showToast={showToast} /> :
    tab === "ai" ? <AiChatTab /> :
    <MoreTab showToast={showToast} />;

  return (
    <div className="app">
      <div className="content">{content}</div>
      <nav className="bottomnav">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            <span style={{ fontSize: 18 }}>{(Ic as any)[t.id]}</span>
            <span>{t.title}</span>
          </button>
        ))}
      </nav>
      <ToastHost text={toast} />
    </div>
  );
}
