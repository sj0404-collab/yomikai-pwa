import React, { useEffect, useMemo, useState } from "react";
import { goto } from "../Shell";
import { addHistory, upsertLib, getState, type LibItem } from "../store";
import {
  srcBridge,
  jp,
  proxyUrl,
  REPO_INDEX_URL,
  type SrcInfo,
  type MangaInfo,
  type ChInfo,
  type RepoExt,
  type InstalledExt,
} from "../bridge";

// Порт экрана «Каталог» (BrowseTab) из оригинального yomikai:
// три вкладки — Источники | Расширения | Миграция.
//  • Источники: группы «Закреплённые» / «Последние» / языки (сортировка оригинала),
//    клик → экран источника, долгое нажатие → диалог (закрепить/отключить).
//  • Расширения: группы «Ожидают обновления» (кнопка «Обновить все») / «Установленные» /
//    «Доступные» по языкам; установка/обновление/удаление (диалог подтверждения).
//  • Миграция: источники библиотеки → тайтл → поиск по остальным источникам → замена.
// Экран источника (BrowseSourceScreen): чипы «Популярные | Последние» + поиск,
// бесконечная сетка тайтлов, страница тайтла с главами.

const PIN_KEY = "yomikai-pinned-sources-v1";
const LAST_KEY = "yomikai-lastused-sources-v1";
const OFF_KEY = "yomikai-disabled-sources-v1";

function loadArr(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as string[];
  } catch {
    return [];
  }
}
function saveArr(key: string, v: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* переполнение */
  }
}

const LANGS: Record<string, string> = {
  ru: "Русский", en: "Английский", ja: "Японский", ko: "Корейский", es: "Испанский",
  fr: "Французский", de: "Немецкий", pt: "Португальский", it: "Итальянский",
  zh: "Китайский", pl: "Польский", tr: "Турецкий", vi: "Вьетнамский", id: "Индонезийский",
  ar: "Арабский", th: "Тайский", uk: "Украинский", all: "Все языки", other: "Другое",
};
const langName = (l: string) => LANGS[l] || (l ? l.toUpperCase() : "Без языка");

function fmtDate(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

type View =
  | { k: "tabs" }
  | { k: "source"; src: SrcInfo; listing: "popular" | "latest" | "search"; query: string; page: number; items: MangaInfo[]; hasNext: boolean; err: string; loading: boolean }
  | { k: "manga"; src: SrcInfo; manga: MangaInfo; chapters: ChInfo[]; loading: boolean; err: string }
  | { k: "migrateSrc"; srcId: string; title: string }
  | { k: "migrateSearch"; item: LibItem; results: { src: SrcInfo; m: MangaInfo }[]; done: boolean };

export default function Browse() {
  const [tab, setTab] = useState<"sources" | "exts" | "migrate">("sources");
  const [view, setView] = useState<View>({ k: "tabs" });
  const [sources, setSources] = useState<SrcInfo[]>([]);
  const [pins, setPins] = useState<string[]>(() => loadArr(PIN_KEY));
  const [lasts, setLasts] = useState<string[]>(() => loadArr(LAST_KEY));
  const [offs, setOffs] = useState<string[]>(() => loadArr(OFF_KEY));
  const [dialog, setDialog] = useState<SrcInfo | null>(null);

  const reload = () => {
    if (!srcBridge) return;
    try {
      const list = jp<SrcInfo[] | { error?: string }>(srcBridge.listSources());
      if (Array.isArray(list)) setSources(list);
    } catch {
      /* движок не ответил */
    }
  };
  useEffect(reload, []);

  const touchLast = (id: string) => {
    const v = [id, ...lasts.filter((x) => x !== id)].slice(0, 8);
    setLasts(v);
    saveArr(LAST_KEY, v);
  };
  const togglePin = (s: SrcInfo) => {
    const v = pins.includes(s.id) ? pins.filter((x) => x !== s.id) : [...pins, s.id];
    setPins(v);
    saveArr(PIN_KEY, v);
  };
  const toggleOff = (s: SrcInfo) => {
    const v = offs.includes(s.id) ? offs.filter((x) => x !== s.id) : [...offs, s.id];
    setOffs(v);
    saveArr(OFF_KEY, v);
  };

  // ---------- экран источника (BrowseSourceScreen) ----------
  const loadListing = (src: SrcInfo, listing: "popular" | "latest" | "search", query: string, page: number, keep: MangaInfo[] = []): View => {
    if (!srcBridge)
      return { k: "source", src, listing, query, page, items: [], hasNext: false, err: "Источники доступны только в APK-обёртке", loading: false };
    try {
      const raw =
        listing === "popular" ? srcBridge.popular(src.id, page)
        : listing === "latest" ? srcBridge.latest(src.id, page)
        : srcBridge.search(src.id, page, query);
      const r = jp<{ hasNext?: boolean; items?: MangaInfo[]; error?: string }>(raw);
      if (r.error) return { k: "source", src, listing, query, page, items: keep, hasNext: false, err: r.error, loading: false };
      const items = page === 1 ? r.items || [] : [...keep, ...(r.items || [])];
      return { k: "source", src, listing, query, page, items, hasNext: !!r.hasNext, err: "", loading: false };
    } catch (e: any) {
      return { k: "source", src, listing, query, page, items: keep, hasNext: false, err: String(e?.message || e), loading: false };
    }
  };

  const openSource = (src: SrcInfo) => {
    touchLast(src.id);
    setView(loadListing(src, "popular", "", 1));
  };

  const openManga = (src: SrcInfo, m: MangaInfo) => {
    setView({ k: "manga", src, manga: m, chapters: [], loading: true, err: "" });
    if (!srcBridge) return;
    try {
      const ch = jp<ChInfo[] | { error?: string }>(srcBridge.chapters(src.id, m.url, m.title));
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

  // ---------- вкладки ----------
  if (view.k === "tabs") {
    const enabled = sources.filter((s) => !offs.includes(s.id));
    const groups: [string, SrcInfo[]][] = [];
    const pinned = enabled.filter((s) => pins.includes(s.id));
    const lastUsed = enabled.filter((s) => lasts.includes(s.id) && !pins.includes(s.id));
    if (pinned.length) groups.push(["Закреплённые", pinned.sort((a, b) => pins.indexOf(a.id) - pins.indexOf(b.id))]);
    if (lastUsed.length) groups.push(["Последние", lastUsed.sort((a, b) => lasts.indexOf(a.id) - lasts.indexOf(b.id))]);
    const byLang = new Map<string, SrcInfo[]>();
    enabled.filter((s) => !pins.includes(s.id) && !lasts.includes(s.id)).forEach((s) => {
      byLang.set(s.lang, [...(byLang.get(s.lang) || []), s]);
    });
    [...byLang.entries()]
      .sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])))
      .forEach(([lang, list]) => groups.push([langName(lang), list.sort((a, b) => a.name.localeCompare(b.name))]));

    return (
      <>
        <div className="topbar">
          <h1>Каталог</h1>
        </div>
        <div className="tabrow">
          <button className={tab === "sources" ? "tab-chip on" : "tab-chip"} onClick={() => setTab("sources")}>Источники</button>
          <button className={tab === "exts" ? "tab-chip on" : "tab-chip"} onClick={() => setTab("exts")}>Расширения</button>
          <button className={tab === "migrate" ? "tab-chip on" : "tab-chip"} onClick={() => setTab("migrate")}>Миграция</button>
        </div>
        <div className="screen">
          {tab === "sources" && <SourcesTab groups={groups} total={sources.length} onOpen={openSource} onLong={setDialog} pins={pins} />}
          {tab === "exts" && <ExtensionsTab onChanged={reload} />}
          {tab === "migrate" && <MigrateTab sources={sources} onPick={(srcId, title) => setView({ k: "migrateSrc", srcId, title })} />}
          {dialog && (
            <div className="sheet-back" onClick={() => setDialog(null)}>
              <div className="sheet" onClick={(e) => e.stopPropagation()}>
                <div className="topbar"><h1>{dialog.name}</h1><button className="btn ghost" onClick={() => setDialog(null)}>✕</button></div>
                <button className="btn ghost list-item" onClick={() => { togglePin(dialog); setDialog(null); }}>
                  {pins.includes(dialog.id) ? "Открепить" : "Закрепить"}
                </button>
                <button className="btn ghost list-item" onClick={() => { toggleOff(dialog); setDialog(null); }}>
                  {offs.includes(dialog.id) ? "Включить источник" : "Отключить источник"}
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ---------- экран источника ----------
  if (view.k === "source" || view.k === "manga") {
    const src = view.k === "source" ? view.src : view.src;
    return (
      <>
        <div className="topbar">
          <button className="btn ghost" onClick={() => setView(view.k === "manga" ? loadListing(view.src, "popular", "", 1) : { k: "tabs" })}>‹</button>
          <h1>{view.k === "manga" ? view.manga.title : src.name}</h1>
        </div>
        {view.k === "source" && (
          <div className="screen">
            <input
              className="input"
              placeholder={`Поиск в ${src.name}…`}
              defaultValue={view.listing === "search" ? view.query : ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const q = (e.target as HTMLInputElement).value.trim();
                  setView(q ? loadListing(src, "search", q, 1) : loadListing(src, "popular", "", 1));
                }
              }}
            />
            <div className="tabrow">
              <button
                className={view.listing === "popular" ? "tab-chip on" : "tab-chip"}
                onClick={() => setView(loadListing(src, "popular", "", 1))}
              >
                Популярные
              </button>
              {src.supportsLatest && (
                <button
                  className={view.listing === "latest" ? "tab-chip on" : "tab-chip"}
                  onClick={() => setView(loadListing(src, "latest", "", 1))}
                >
                  Последние
                </button>
              )}
              {view.listing === "search" && <span className="tab-chip on">Поиск: {view.query}</span>}
            </div>
            {view.err && <div className="panel muted">Ошибка источника: {view.err}</div>}
            <div className="grid">
              {view.items.map((m, i) => (
                <button key={m.url + m.title + i} className="card" onClick={() => openManga(src, m)}>
                  {m.thumb ? <img src={proxyUrl(m.thumb, m.ref)} alt="" loading="lazy" crossOrigin="anonymous" /> : <div className="cover-ph" />}
                  <div className="t">{m.title}</div>
                </button>
              ))}
            </div>
            {view.hasNext && (
              <button className="btn ghost" onClick={() => setView(loadListing(src, view.listing, view.query, view.page + 1, view.items))}>
                Ещё…
              </button>
            )}
          </div>
        )}
        {view.k === "manga" && (
          <div className="screen">
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              {view.manga.thumb ? (
                <img src={proxyUrl(view.manga.thumb, view.manga.ref)} alt="" crossOrigin="anonymous" style={{ width: 110, borderRadius: 10, objectFit: "cover" }} />
              ) : (
                <div className="cover-ph" style={{ width: 110 }} />
              )}
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

  // ---------- миграция: тайтлы источника ----------
  if (view.k === "migrateSrc") {
    const items = getState().library.filter((l) => l.srcId === view.srcId);
    return (
      <>
        <div className="topbar">
          <button className="btn ghost" onClick={() => setView({ k: "tabs" })}>‹</button>
          <h1>{view.title}</h1>
        </div>
        <div className="screen">
          <div className="panel muted">Выберите тайтл — найдём его в других источниках и перенесём запись библиотеки.</div>
          {items.map((it) => (
            <div key={it.id} className="list-item" style={{ cursor: "pointer" }} onClick={() => setView({ k: "migrateSearch", item: it, results: [], done: false })}>
              <div className="grow">
                <div className="t">{it.title}</div>
                <div className="muted">{it.lastChapter ? `последняя глава: ${it.lastChapter}` : ""}</div>
              </div>
              <span className="badge">мигрировать</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ---------- миграция: поиск замены ----------
  if (view.k === "migrateSearch") {
    return (
      <MigrateSearch
        item={view.item}
        sources={sources.filter((s) => s.id !== view.item.srcId)}
        results={view.results}
        done={view.done}
        onUpdate={(results, done) => setView({ ...view, results, done })}
        onBack={() => setView({ k: "migrateSrc", srcId: view.item.srcId || "", title: view.item.source })}
        onReplaced={() => {
          addHistory(view.item.title, "миграция завершена");
          setView({ k: "tabs" });
        }}
      />
    );
  }
  return null;
}

// ================= Источники =================
function SourcesTab({
  groups,
  total,
  onOpen,
  onLong,
  pins,
}: {
  groups: [string, SrcInfo[]][];
  total: number;
  onOpen: (s: SrcInfo) => void;
  onLong: (s: SrcInfo) => void;
  pins: string[];
}) {
  const longTimer = React.useRef<number | null>(null);
  if (!srcBridge) {
    return (
      <div className="panel muted">
        В браузере APK-расширения недоступны. Установите APK-обёртку «yomikai web» — в ней здесь работают
        те же источники-расширения, что и в оригинальном yomikai. Список расширений — вкладка «Расширения».
      </div>
    );
  }
  if (total === 0) {
    return (
      <div className="panel muted">
        Источники не найдены. Установите расширения (вкладка «Расширения») — уже установленные для
        оригинального yomikai подхватываются автоматически.
      </div>
    );
  }
  return (
    <>
      {groups.map(([header, list]) => (
        <div key={header}>
          <div className="panel muted">{header} · {list.length}</div>
          {list.map((s) => (
            <div
              key={s.id}
              className="list-item"
              style={{ cursor: "pointer" }}
              onClick={() => onOpen(s)}
              onPointerDown={() => {
                longTimer.current = window.setTimeout(() => onLong(s), 550);
              }}
              onPointerUp={() => { if (longTimer.current) clearTimeout(longTimer.current); }}
              onPointerLeave={() => { if (longTimer.current) clearTimeout(longTimer.current); }}
            >
              <div className="grow">
                <div className="t">{s.name}{s.nsfw ? " · 18+" : ""}</div>
                <div className="muted">{langName(s.lang)}</div>
              </div>
              {s.supportsLatest && <span className="badge">лента</span>}
              <button
                className="btn ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onLong(s);
                }}
              >
                {pins.includes(s.id) ? "📌" : "⋮"}
              </button>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// ================= Расширения =================
function ExtensionsTab({ onChanged }: { onChanged: () => void }) {
  const [installed, setInstalled] = useState<InstalledExt[]>([]);
  const [available, setAvailable] = useState<RepoExt[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState<InstalledExt | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadAll = () => {
    if (srcBridge) {
      try {
        setInstalled(jp<InstalledExt[]>(srcBridge.extensions()));
      } catch {
        /* нет моста */
      }
    }
    const fetchRepo = async () => {
      try {
        const raw = srcBridge ? srcBridge.repoIndex() : await (await fetch(REPO_INDEX_URL)).text();
        setAvailable(jp<RepoExt[]>(raw));
      } catch {
        setAvailable([]);
      }
      setLoading(false);
    };
    fetchRepo();
  };
  useEffect(reloadAll, []);

  const byPkg = useMemo(() => new Map(installed.map((e) => [e.pkg, e])), [installed]);
  const matches = (name: string, pkg: string) =>
    !query || name.toLowerCase().includes(query.toLowerCase()) || pkg.toLowerCase().includes(query.toLowerCase());

  const updates = installed.filter((e) => {
    const a = available.find((x) => x.pkg === e.pkg);
    return a && a.code > e.code;
  });
  const availableByLang = new Map<string, RepoExt[]>();
  available
    .filter((e) => !byPkg.has(e.pkg) && matches(e.name, e.pkg))
    .forEach((e) => availableByLang.set(e.lang, [...(availableByLang.get(e.lang) || []), e]));

  const install = (e: RepoExt) => {
    if (!srcBridge) return;
    setBusy(`Установка ${e.name}… После системного диалога вернитесь и обновите список.`);
    try {
      srcBridge.installExtensionDirect(e.apk);
    } catch (err: any) {
      setBusy(String(err?.message || err));
    }
  };
  const uninstall = (e: InstalledExt) => {
    if (!srcBridge) return;
    try {
      srcBridge.uninstallExtension(e.pkg);
    } catch {
      /* игнор */
    }
    setConfirm(null);
  };
  const refresh = () => {
    if (srcBridge) {
      try {
        srcBridge.reloadSources();
      } catch {
        /* игнор */
      }
    }
    reloadAll();
    onChanged();
    setBusy("");
  };

  if (!srcBridge && loading) return <div className="panel muted">Загружаем индекс расширений…</div>;

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" placeholder="Поиск расширений…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn ghost" onClick={refresh} title="Обновить список">⟳</button>
      </div>
      {busy && <div className="panel muted">{busy}</div>}
      {!srcBridge && (
        <div className="panel muted">
          Это реальный индекс репозитория расширений (keiyoushi) — тот же, что использует оригинальный yomikai.
          Установка и запуск источников — в APK-обёртке «yomikai web».
        </div>
      )}

      {updates.length > 0 && (
        <>
          <div className="panel muted row">
            <span className="grow">Ожидают обновления · {updates.length}</span>
            <button className="btn" onClick={() => updates.forEach((e) => {
              const a = available.find((x) => x.pkg === e.pkg);
              if (a) install(a);
            })}>
              Обновить все
            </button>
          </div>
          {updates.map((e) => (
            <ExtItem key={"u" + e.pkg} name={e.name} pkg={e.pkg} version={e.version} badge="обновление"
              action={srcBridge ? { label: "Обновить", fn: () => { const a = available.find((x) => x.pkg === e.pkg); if (a) install(a); } } : undefined} />
          ))}
        </>
      )}

      {installed.filter((e) => matches(e.name, e.pkg)).length > 0 && (
        <>
          <div className="panel muted">Установленные · {installed.length}</div>
          {installed.filter((e) => matches(e.name, e.pkg)).map((e) => (
            <ExtItem key={"i" + e.pkg} name={e.name} pkg={e.pkg} version={e.version} nsfw={e.nsfw}
              action={srcBridge ? { label: "Удалить", fn: () => setConfirm(e), danger: true } : undefined} />
          ))}
        </>
      )}

      {[...availableByLang.entries()].sort((a, b) => (a[0] === "ru" ? -1 : b[0] === "ru" ? 1 : a[0].localeCompare(b[0]))).map(([lang, list]) => (
        <div key={lang}>
          <div className="panel muted">{langName(lang)} · {list.length}</div>
          {list.map((e) => (
            <ExtItem key={"a" + e.pkg} name={e.name} pkg={e.pkg} version={e.version} lang={lang} nsfw={!!e.nsfw}
              action={srcBridge ? { label: "Установить", fn: () => install(e) } : { label: "APK", href: e.apk }} />
          ))}
        </div>
      ))}
      {!loading && available.length === 0 && <div className="panel muted">Индекс репозитория недоступен (нет сети?).</div>}

      {confirm && (
        <div className="sheet-back" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="topbar"><h1>Удалить расширение?</h1></div>
            <div className="panel">{confirm.name} ({confirm.pkg}) будет удалено с устройства.</div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost grow" onClick={() => setConfirm(null)}>Отмена</button>
              <button className="btn grow" onClick={() => uninstall(confirm)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ExtItem({
  name, pkg, version, lang, nsfw, badge, action,
}: {
  name: string; pkg: string; version: string; lang?: string; nsfw?: boolean; badge?: string;
  action?: { label: string; fn?: () => void; href?: string; danger?: boolean };
}) {
  return (
    <div className="list-item">
      <div className="grow">
        <div className="t">{name}{nsfw ? " · 18+" : ""}</div>
        <div className="muted">{pkg} · v{version}{lang ? ` · ${langName(lang)}` : ""}</div>
      </div>
      {badge && <span className="badge">{badge}</span>}
      {action && action.href && <a className="btn ghost" href={action.href} download>{action.label}</a>}
      {action && action.fn && (
        <button className={action.danger ? "btn danger" : "btn"} onClick={action.fn}>{action.label}</button>
      )}
    </div>
  );
}

// ================= Миграция =================
function MigrateTab({ sources, onPick }: { sources: SrcInfo[]; onPick: (srcId: string, title: string) => void }) {
  const s = getState().library.filter((l) => l.srcId);
  const bySrc = new Map<string, LibItem[]>();
  s.forEach((l) => bySrc.set(l.srcId!, [...(bySrc.get(l.srcId!) || []), l]));
  if (bySrc.size === 0) {
    return <div className="panel muted">В библиотеке нет тайтлов из источников — мигрировать нечего.</div>;
  }
  return (
    <>
      <div className="panel muted">Выберите источник — затем тайтл, который нужно перенести в другой источник.</div>
      {[...bySrc.entries()].map(([srcId, items]) => {
        const src = sources.find((x) => x.id === srcId);
        return (
          <div key={srcId} className="list-item" style={{ cursor: "pointer" }} onClick={() => onPick(srcId, src?.name || items[0].source)}>
            <div className="grow">
              <div className="t">{src?.name || items[0].source}</div>
              <div className="muted">тайтлов в библиотеке: {items.length}</div>
            </div>
            <span className="badge">›</span>
          </div>
        );
      })}
    </>
  );
}

function MigrateSearch({
  item, sources, results, done, onUpdate, onBack, onReplaced,
}: {
  item: LibItem;
  sources: SrcInfo[];
  results: { src: SrcInfo; m: MangaInfo }[];
  done: boolean;
  onUpdate: (r: { src: SrcInfo; m: MangaInfo }[], done: boolean) => void;
  onBack: () => void;
  onReplaced: () => void;
}) {
  const [busy, setBusy] = useState(!done);
  useEffect(() => {
    if (done || !srcBridge) return;
    let cancel = false;
    const run = async () => {
      const acc: { src: SrcInfo; m: MangaInfo }[] = [];
      for (const s of sources) {
        if (cancel) return;
        try {
          const r = jp<{ items?: MangaInfo[]; error?: string }>(srcBridge.search(s.id, 1, item.title));
          (r.items || []).slice(0, 3).forEach((m) => acc.push({ src: s, m }));
        } catch {
          /* источник не ответил — пропускаем, как в оригинальном global search */
        }
        onUpdate([...acc], false);
        await new Promise((res) => setTimeout(res, 0));
      }
      if (!cancel) {
        onUpdate(acc, true);
        setBusy(false);
      }
    };
    run();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replace = (src: SrcInfo, m: MangaInfo) => {
    upsertLib({
      ...item,
      title: m.title,
      source: src.name,
      cover: proxyUrl(m.thumb, m.ref),
      srcId: src.id,
      mangaUrl: m.url,
      referer: m.ref,
      lastChapter: undefined,
      updatedAt: Date.now(),
    });
    onReplaced();
  };

  return (
    <>
      <div className="topbar">
        <button className="btn ghost" onClick={onBack}>‹</button>
        <h1>Миграция: {item.title}</h1>
      </div>
      <div className="screen">
        {busy && <div className="panel muted">Ищем «{item.title}» в {sources.length} источниках…</div>}
        {!busy && results.length === 0 && <div className="panel muted">Ничего не найдено.</div>}
        {results.map(({ src, m }, i) => (
          <div key={src.id + m.url + i} className="list-item" style={{ cursor: "pointer" }} onClick={() => replace(src, m)}>
            {m.thumb ? (
              <img src={proxyUrl(m.thumb, m.ref)} alt="" crossOrigin="anonymous" style={{ width: 44, borderRadius: 6, objectFit: "cover" }} />
            ) : (
              <div className="cover-ph" style={{ width: 44, aspectRatio: "2/3" }} />
            )}
            <div className="grow">
              <div className="t">{m.title}</div>
              <div className="muted">{src.name}</div>
            </div>
            <span className="badge">заменить</span>
          </div>
        ))}
      </div>
    </>
  );
}
