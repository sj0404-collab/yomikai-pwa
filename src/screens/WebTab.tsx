import React, { useEffect, useRef, useState } from "react";
import { param } from "../Shell";
import { siteBridge, type SiteState } from "../bridge";

// Вкладка «Веб».
// В APK-обёртке (?bar=1) — это тулбар поверх нативного сайт-WebView (как в
// оригинальном yomikai: назад/вперёд/обновить/стоп, адресная строка, закладки
// с иерархией, системные загрузки на нативной стороне).
// В браузере — самостоятельный веб-вью через iframe (реальная навигация,
// история, закладки; сайты с X-Frame-Options честно сообщают об отказе).

const DEFAULT_MARKS: { title: string; url: string }[] = [
  { title: "Манга · Mangabuff", url: "https://mangabuff.ru/" },
  { title: "Манга · Remanga", url: "https://remanga.org/" },
  { title: "Манга · MangaLib", url: "https://mangalib.me/" },
  { title: "Манга · ReadManga", url: "https://readmanga.io/" },
  { title: "Манга · MintManga", url: "https://mintmanga.live/" },
  { title: "Аниме · AnimeVost", url: "https://animevost.org/" },
  { title: "Аниме · AniLibria", url: "https://anilibria.tv/" },
  { title: "Аниме · AnimeBest", url: "https://animebest.org/" },
  { title: "Ранобэ · RanobeLib", url: "https://ranobelib.me/" },
  { title: "Ранобэ · NoveLib", url: "https://novelib.me/" },
];
const MARKS_KEY = "yomikai-pwa-marks-v1";
const LAST_KEY = "yomikai-pwa-web-last";

function loadMarks() {
  try {
    const raw = localStorage.getItem(MARKS_KEY);
    if (raw) return JSON.parse(raw) as { title: string; url: string }[];
  } catch {
    /* пусто */
  }
  return DEFAULT_MARKS;
}
function saveMarks(m: { title: string; url: string }[]) {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify(m));
  } catch {
    /* переполнение — не критично */
  }
}
function normalize(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(t)) return "https://" + t;
  return "https://duckduckgo.com/?q=" + encodeURIComponent(t);
}

/** Режим тулбара обёртки: управляем нативным сайт-WebView. */
function BarMode() {
  const [st, setSt] = useState<SiteState>({ url: "", title: "", canBack: false, canForward: false, progress: 100 });
  const [input, setInput] = useState("");
  const [sheet, setSheet] = useState<"" | "marks">("");
  const [marks, setMarks] = useState(loadMarks);
  const editing = useRef(false);

  useEffect(() => {
    (window as any).onSiteState = (json: string) => {
      try {
        const s = typeof json === "string" ? (JSON.parse(json) as SiteState) : (json as SiteState);
        setSt(s);
        if (!editing.current) setInput(s.url || "");
      } catch {
        /* игнор */
      }
    };
    try {
      const raw = siteBridge?.state();
      if (raw) (window as any).onSiteState(raw);
    } catch {
      /* мост ещё не готов */
    }
    return () => {
      (window as any).onSiteState = undefined;
    };
  }, []);

  useEffect(() => {
    // высота оверлея: тулбар 56dp, с открытой панелью закладок — больше
    try {
      siteBridge?.setBarHeight(sheet ? 320 : 56);
    } catch {
      /* нет моста */
    }
  }, [sheet]);

  const addMark = () => {
    if (!st.url) return;
    const title = prompt("Название закладки (иерархия через « · »):", st.title || st.url);
    if (!title) return;
    const m = [{ title, url: st.url }, ...marks.filter((x) => x.url !== st.url)];
    setMarks(m);
    saveMarks(m);
  };

  const groups = marks.reduce<Record<string, { title: string; url: string }[]>>((acc, m) => {
    const g = m.title.includes(" · ") ? m.title.split(" · ")[0] : "Без категории";
    (acc[g] = acc[g] || []).push(m);
    return acc;
  }, {});

  return (
    <div style={{ background: "var(--bg2, #1b1e23)", borderBottom: "1px solid #2a2e35" }}>
      <div className="row" style={{ gap: 4, padding: "8px 8px", alignItems: "center" }}>
        <button className="btn ghost" disabled={!st.canBack} onClick={() => siteBridge?.back()}>‹</button>
        <button className="btn ghost" disabled={!st.canForward} onClick={() => siteBridge?.forward()}>›</button>
        <button className="btn ghost" onClick={() => (st.progress < 100 ? siteBridge?.stop() : siteBridge?.reload())}>
          {st.progress < 100 ? "✕" : "⟳"}
        </button>
        <input
          className="input grow"
          value={input}
          onFocus={() => (editing.current = true)}
          onBlur={() => (editing.current = false)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              siteBridge?.nav(normalize(input));
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Адрес или поиск"
        />
        <button className="btn ghost" onClick={addMark} title="В закладки">☆</button>
        <button className="btn ghost" onClick={() => setSheet(sheet === "marks" ? "" : "marks")} title="Закладки">☰</button>
      </div>
      {st.progress < 100 && <div style={{ height: 2, background: "#3d7dfd", width: `${st.progress}%`, transition: "width .2s" }} />}
      {sheet === "marks" && (
        <div style={{ maxHeight: 250, overflowY: "auto", padding: "4px 8px 8px" }}>
          {Object.entries(groups).map(([g, list]) => (
            <div key={g}>
              <div className="muted" style={{ fontSize: 12, padding: "4px 2px" }}>{g}</div>
              {list.map((m) => (
                <div key={m.url} className="list-item" style={{ cursor: "pointer", padding: "6px 4px" }}
                  onClick={() => { siteBridge?.nav(m.url); setSheet(""); }}>
                  <div className="grow"><div className="t">{m.title.includes(" · ") ? m.title.split(" · ").slice(1).join(" · ") : m.title}</div></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Режим браузера: самостоятельная веб-вкладка (iframe + своя история). */
function FrameMode() {
  const [marks, setMarks] = useState(loadMarks);
  const [url, setUrl] = useState(() => {
    const q = param("url");
    return q || localStorage.getItem(LAST_KEY) || DEFAULT_MARKS[0].url;
  });
  const [input, setInput] = useState(url);
  const [showMarks, setShowMarks] = useState(false);
  const history = useRef<string[]>([url]);
  const hIdx = useRef(0);
  const [nav, setNav] = useState({ back: false, fwd: false });

  const go = (u: string, push = true) => {
    if (!u) return;
    setUrl(u);
    setInput(u);
    localStorage.setItem(LAST_KEY, u);
    if (push) {
      history.current = history.current.slice(0, hIdx.current + 1);
      history.current.push(u);
      hIdx.current = history.current.length - 1;
    }
    setNav({ back: hIdx.current > 0, fwd: hIdx.current < history.current.length - 1 });
  };
  const step = (d: number) => {
    const i = hIdx.current + d;
    if (i < 0 || i >= history.current.length) return;
    hIdx.current = i;
    go(history.current[i], false);
  };
  useEffect(() => {
    const t = setTimeout(() => setShowMarks(false), 0);
    return () => clearTimeout(t);
  }, []);

  const groups = marks.reduce<Record<string, { title: string; url: string }[]>>((acc, m) => {
    const g = m.title.includes(" · ") ? m.title.split(" · ")[0] : "Без категории";
    (acc[g] = acc[g] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="web-wrap">
      <div className="urlbar">
        <button className="btn ghost" disabled={!nav.back} onClick={() => step(-1)} title="Назад">‹</button>
        <button className="btn ghost" disabled={!nav.fwd} onClick={() => step(1)} title="Вперёд">›</button>
        <button className="btn ghost" onClick={() => go(url, false)} title="Обновить">⟳</button>
        <input
          className="input grow"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go(normalize(input))}
          placeholder="Адрес или поиск"
        />
        <button
          className="btn ghost"
          title="В закладки"
          onClick={() => {
            const title = prompt("Название закладки (иерархия через « · »):", url);
            if (!title) return;
            const m = [{ title, url }, ...marks.filter((x) => x.url !== url)];
            setMarks(m);
            saveMarks(m);
          }}
        >
          ☆
        </button>
        <button className="btn ghost" onClick={() => setShowMarks(!showMarks)} title="Закладки">☰</button>
      </div>
      {showMarks && (
        <div className="marks-sheet">
          {Object.entries(groups).map(([g, list]) => (
            <div key={g}>
              <div className="muted" style={{ fontSize: 12, padding: "4px 2px" }}>{g}</div>
              {list.map((m) => (
                <div key={m.url} className="list-item" style={{ cursor: "pointer" }} onClick={() => { go(m.url); setShowMarks(false); }}>
                  <div className="grow">
                    <div className="t">{m.title.includes(" · ") ? m.title.split(" · ").slice(1).join(" · ") : m.title}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <iframe ref={undefined} src={url} className="web-frame" title="web" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" />
      <div className="panel muted" style={{ margin: 8 }}>
        Некоторые сайты запрещают встраивание (X-Frame-Options) — в APK-обёртке «Веб» открывается в нативном
        WebView без этих ограничений.
      </div>
    </div>
  );
}

export default function WebTab() {
  if (param("bar") === "1" && siteBridge) return <BarMode />;
  return <FrameMode />;
}
