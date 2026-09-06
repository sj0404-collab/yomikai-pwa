import React, { useEffect, useMemo, useState } from "react";
import { goto } from "../Shell";
import { addHistory, upsertLib, getState } from "../store";
import {
  srcBridge,
  jp,
  proxyUrl,
  REPO_INDEX_URL,
  type SrcInfo,
  type MangaInfo,
  type ChInfo,
  type RepoExt,
} from "../bridge";

// Каталог = порт движка расширений оригинального yomikai: источники — те же
// APK-расширения, что установлены на устройстве (feature «tachiyomi.extension»).
// В обёртке работает нативно через мост YomikaiSources; в браузере показываем
// реальный индекс репозитория расширений (установка — только в APK).

type View =
  | { k: "sources" }
  | { k: "exts" }
  | { k: "src"; src: SrcInfo; mode: "popular" | "latest" | "search"; query: string; page: number; items: MangaInfo[]; hasNext: boolean; loading: boolean; err: string }
  | { k: "manga"; src: SrcInfo; manga: MangaInfo; chapters: ChInfo[]; loading: boolean; err: string };

function fmtDate(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Browse() {
  const [view, setView] = useState<View>({ k: "sources" });
  const [sources, setSources] = useState<SrcInfo[]>([]);
  const [exts, setExts] = useState<RepoExt[] | null>(null);
  const [installed, setInstalled] = useState<{ pkg: string; name: string; version: string; nsfw: boolean }[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!srcBridge) return;
    try {
      setSources(jp<SrcInfo[]>(srcBridge.listSources()) as any);
      setInstalled(jp<any[]>(srcBridge.extensions()));
    } catch {
      /* движок не ответил */
    }
  }, []);

  const repo = jp<SrcInfo[]>(JSON.stringify(sources)) as unknown as SrcInfo[];
  const langs = useMemo(() => {
    const m = new Map<string, SrcInfo[]>();
    repo.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()) || s.lang.toLowerCase().includes(filter.toLowerCase())).forEach((s) => {
      const arr = m.get(s.lang) || [];
      arr.push(s);
      m.set(s.lang, arr);
    });
    return [...m.entries()].sort((a, b) => (a[0] === "ru" ? -1 : b[0] === "ru" ? 1 : a[0].localeCompare(b[0])));
  }, [repo, filter]);

  const loadMangas = (src: SrcInfo, mode: "popular" | "latest" | "search", query: string, page: number): View => {
    if (!srcBridge) return { k: "src", src, mode, query, page: 1, items: [], hasNext: false, loading: false, err: "Движок источников доступен только в APK-обёртке" };
    try {
      const raw =
        mode === "popular"
          ? srcBridge.popular(src.id, page)
          : mode === "latest"
            ? srcBridge.latest(src.id, page)
            : srcBridge.search(src.id, page, query);
      const r = jp<{ hasNext?: boolean; items?: MangaInfo[]; error?: string }>(raw);
      if (r.error) return { k: "src", src, mode, query, page, items: [], hasNext: false, loading: false, err: r.error };
      return { k: "src", src, mode, query, page, items: r.items || [], hasNext: !!r.hasNext, loading: false, err: "" };
    } catch (e: any) {
      return { k: "src", src, mode, query, page, items: [], hasNext: false, loading: false, err: String(e?.message || e) };
    }
  };

  const openSource = (src: SrcInfo) => setView(loadMangas(src, "popular", "", 1));

  const openManga = (src: SrcInfo, m: MangaInfo) => {
    setView({ k: "manga", src, manga: m, chapters: [], loading: true, err: "" });
    if (!srcBridge) return;
    try {
      const ch = jp<ChInfo[] | { error: string }>(srcBridge.chapters(src.id, m.url, m.title));
      if (Array.isArray(ch)) setView({ k: "manga", src, manga: m, chapters: ch, loading: false, err: "" });
      else setView({ k: "manga", src, manga: m, chapters: [], loading: false, err: (ch as any).error || "Ошибка" });
    } catch (e: any) {
      setView({ k: "manga", src, manga: m, chapters: [], loading: false, err: String(e?.message || e) });
    }
  };

  const openChapter = (src: SrcInfo, m: MangaInfo, ch: ChInfo) => {
    addHistory(`${m.title} · ${ch.name}`, "чтение главы");
    goto("reader", { src: src.id, mt: m.title, mu: m.url, cn: ch.name, cu: ch.url });
  };

  const toLibrary = (src: SrcInfo, m: MangaInfo) => {
    upsertLib({
      id: `r-${src.id}-${m.url}`,
      title: m.title,
      source: src.name,
      cover: proxyUrl(m.thumb, m.ref),
      srcId: src.id,
      mangaUrl: m.url,
      referer: m.ref,
      pages: [],
      lastPage: 0,
      updatedAt: Date.now(),
    });
    addHistory(m.title, "добавлено в библиотеку");
  };

  const loadRepo = async () => {
    setBusy("Загружаем индекс расширений…");
    try {
      let raw: string;
      if (srcBridge) raw = srcBridge.repoIndex();
      else raw = await (await fetch(REPO_INDEX_URL)).text();
      setExts(jp<RepoExt[]>(raw));
    } catch (e: any) {
      setExts([]);
      setBusy("Индекс недоступен: " + String(e?.message || e));
      return;
    }
    setBusy("");
    setView({ k: "exts" });
  };

  // ---------- экраны ----------
  if (view.k === "exts") {
    return (
      <>
        <div className="topbar">
          <button className="btn ghost" onClick={() => setView({ k: "sources" })}>‹</button>
          <h1>Расширения</h1>
          <span className="muted">{exts?.length ?? 0}</span>
        </div>
        <div className="screen">
          {!srcBridge && (
            <div className="panel muted">
              Это реальный индекс репозитория расширений (keiyoushi). Установка и запуск источников доступны
              в APK-обёртке «yomikai web» — там расширения работают как в оригинальном приложении.
            </div>
          )}
          {installed.length > 0 && (
            <>
              <div className="panel muted">Установлено на устройстве: {installed.length}</div>
              {installed.map((e) => (
                <div key={e.pkg} className="list-item">
                  <div className="grow">
                    <div className="t">{e.name}</div>
                    <div className="muted">{e.pkg} · v{e.version}{e.nsfw ? " · 18+" : ""}</div>
                  </div>
                  <span className="badge">установлено</span>
                </div>
              ))}
              <div className="hr" />
            </>
          )}
          {(exts || []).map((e) => (
            <div key={e.pkg} className="list-item">
              <div className="grow">
                <div className="t">{e.name}</div>
                <div className="muted">{e.lang} · v{e.version}{e.nsfw ? " · 18+" : ""}</div>
              </div>
              {srcBridge && (
                <button
                  className="btn"
                  disabled={busy !== ""}
                  onClick={() => {
                    setBusy(`Скачиваем ${e.name}…`);
                    try {
                      srcBridge.installExtensionDirect(e.apk);
                      setBusy("");
                    } catch (err: any) {
                      setBusy(String(err?.message || err));
                    }
                  }}
                >
                  Установить
                </button>
              )}
              {!srcBridge && e.apk && (
                <a className="btn ghost" href={e.apk} download>APK</a>
              )}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (view.k === "src" || view.k === "manga") {
    const src = view.src;
    return (
      <>
        <div className="topbar">
          <button className="btn ghost" onClick={() => setView(view.k === "manga" ? loadMangas(view.src, "popular", "", 1) : { k: "sources" })}>‹</button>
          <h1>{view.k === "manga" ? view.manga.title : src.name}</h1>
        </div>
        {view.k === "src" && (
          <div className="screen">
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className={`btn ${view.mode === "popular" ? "" : "ghost"}`} onClick={() => setView(loadMangas(src, "popular", "", 1))}>Популярное</button>
              {src.supportsLatest && (
                <button className={`btn ${view.mode === "latest" ? "" : "ghost"}`} onClick={() => setView(loadMangas(src, "latest", "", 1))}>Свежее</button>
              )}
              <input
                className="input grow"
                placeholder="Поиск…"
                defaultValue={view.query}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setView(loadMangas(src, "search", (e.target as HTMLInputElement).value, 1));
                }}
              />
            </div>
            {view.err && <div className="panel muted">Ошибка источника: {view.err}</div>}
            <div className="grid">
              {view.items.map((m) => (
                <button key={m.url + m.title} className="card" onClick={() => openManga(src, m)}>
                  {m.thumb ? <img src={proxyUrl(m.thumb, m.ref)} alt="" loading="lazy" crossOrigin="anonymous" /> : <div className="cover-ph" />}
                  <div className="t">{m.title}</div>
                </button>
              ))}
            </div>
            {view.hasNext && (
              <button className="btn ghost" onClick={() => setView(loadMangas(src, view.mode, view.query, view.page + 1))}>
                Ещё…
              </button>
            )}
          </div>
        )}
        {view.k === "manga" && (
          <div className="screen">
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              {view.manga.thumb ? (
                <img src={proxyUrl(view.manga.thumb, view.manga.ref)} alt="" crossOrigin="anonymous"
                  style={{ width: 110, borderRadius: 10, objectFit: "cover" }} />
              ) : <div className="cover-ph" style={{ width: 110 }} />}
              <div className="grow">
                <div className="t" style={{ fontSize: 17 }}>{view.manga.title}</div>
                <div className="muted">{[view.manga.author, view.manga.artist].filter(Boolean).join(" · ")}</div>
                <div className="muted">{view.manga.genre}</div>
                <button className="btn" style={{ marginTop: 8 }} onClick={() => toLibrary(src, view.manga)}>＋ В библиотеку</button>
              </div>
            </div>
            {view.manga.desc && <div className="panel" style={{ whiteSpace: "pre-wrap" }}>{view.manga.desc}</div>}
            {view.err && <div className="panel muted">Главы: {view.err}</div>}
            {view.loading && <div className="panel muted">Загружаем главы…</div>}
            {view.chapters.map((ch) => (
              <div key={ch.url + ch.name} className="list-item" style={{ cursor: "pointer" }} onClick={() => openChapter(src, view.manga, ch)}>
                <div className="grow">
                  <div className="t">{ch.name}</div>
                  <div className="muted">{[fmtDate(ch.date), ch.scan].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="badge">читать</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // список источников
  return (
    <>
      <div className="topbar">
        <h1>Каталоги</h1>
        <button className="btn ghost" onClick={loadRepo}>{busy ? "…" : "Расширения"}</button>
      </div>
      <div className="screen">
        <input className="input" placeholder="Фильтр источников…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {busy && <div className="panel muted">{busy}</div>}
        {!srcBridge && (
          <div className="panel muted">
            В браузере APK-расширения недоступны. Установите APK-обёртку «yomikai web» — в ней здесь работают
            те же источники-расширения, что и в оригинальном yomikai (общий репозиторий расширений).
            Список расширений — кнопка «Расширения» сверху.
          </div>
        )}
        {srcBridge && sources.length === 0 && (
          <div className="panel muted">
            Источники не найдены. Установите расширения (кнопка «Расширения» сверху) — они общие с оригинальным
            yomikai: уже установленные подхватываются автоматически.
          </div>
        )}
        {langs.map(([lang, list]) => (
          <div key={lang}>
            <div className="panel muted">{lang.toUpperCase()} · {list.length}</div>
            {list.map((s) => (
              <div key={s.id} className="list-item" style={{ cursor: "pointer" }} onClick={() => openSource(s)}>
                <div className="grow">
                  <div className="t">{s.name}{s.nsfw ? " · 18+" : ""}</div>
                  <div className="muted">{s.ext}</div>
                </div>
                <span className="badge">{s.supportsLatest ? "popular·latest" : "popular"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
