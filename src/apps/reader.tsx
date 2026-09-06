import React, { useState, useSyncExternalStore } from "react";
import { mount } from "./mount";
import { getState, subscribe, type LibItem } from "../store";
import { param } from "../Shell";
import { srcBridge, jp, proxyUrl, type PageInfo } from "../bridge";
import Reader from "../reader/Reader";

// PWA «Читалка»:
//  • ?open=<id> — тайтл из библиотеки (локальные страницы);
//  • ?src&mu&mt&cu&cn — реальная глава из каталога (движок расширений обёртки).
function Root() {
  const [id] = useState<string | null>(param("open"));
  const s = useSyncExternalStore(subscribe, getState);
  const [remote] = useState<{ item: LibItem | null; err: string }>(() => {
    const src = param("src");
    const cu = param("cu");
    if (!src || !cu) return { item: null, err: "" };
    if (!srcBridge) return { item: null, err: "Чтение глав из каталога доступно только в APK-обёртке" };
    try {
      const pages = jp<PageInfo[] | { error?: string }>(srcBridge.pages(src, cu, param("cn") || ""));
      if (Array.isArray(pages) && pages.length) {
        return {
          item: {
            id: `r-${src}-${cu}`,
            title: `${param("mt") || "Тайтл"} — ${param("cn") || cu}`,
            source: param("mt") || "",
            cover: "",
            srcId: src,
            mangaUrl: param("mu") || "",
            pages: pages.map((p) => ({ img: proxyUrl(p.image, p.referer), text: "" })),
            lastPage: 0,
            lastChapter: param("cn") || "",
            updatedAt: Date.now(),
          },
          err: "",
        };
      }
      return { item: null, err: (pages as any)?.error || "Глава пуста или источник не ответил" };
    } catch (e: any) {
      return { item: null, err: String(e?.message || e) };
    }
  });

  const remoteErr = remote.err;
  const item: LibItem | null = remote.item ?? s.library.find((l) => l.id === id) ?? null;

  if (!item) {
    return (
      <div className="screen">
        <div className="topbar">
          <h1>Читалка</h1>
        </div>
        {remoteErr && <div className="panel muted">{remoteErr}</div>}
        {!remoteErr && s.library.length === 0 && (
          <div className="panel muted">Откройте тайтл из Библиотеки или найдите в Каталогах.</div>
        )}
        {!remoteErr &&
          s.library.map((l) => (
            <div key={l.id} className="list-item" style={{ cursor: "pointer" }} onClick={() => location.search = "?open=" + encodeURIComponent(l.id)}>
              <div className="grow">
                <div className="t">{l.title}</div>
                <div className="muted">{l.source}{l.pages.length ? ` · ${l.pages.length} стр.` : ""}</div>
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
