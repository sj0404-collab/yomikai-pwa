// Общий маунт PWA-вкладки: service worker своей области + Frame.
import React from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { Frame, type TabId } from "../Shell";

export function mount(tab: TabId, node: React.ReactNode) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* офлайн-оболочка опциональна */
    });
  }
  if (typeof speechSynthesis !== "undefined") {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Frame tab={tab}>{node}</Frame>
    </React.StrictMode>,
  );
}
