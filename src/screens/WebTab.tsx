import React, { useEffect, useRef, useState } from "react";

// Закладки по умолчанию — те же RU-сайты, что в APK (иерархия: префикс категории).
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

function normalize(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(t)) return "https://" + t;
  return "https://duckduckgo.com/?q=" + encodeURIComponent(t); // поиск, как в APK
}

export default function WebTab() {
  const [marks, setMarks] = useState(loadMarks);
  const [url, setUrl] = useState(() => {
    // ?url= — переход из соседней PWA или из Kotlin-обёртки
    const q = new URLSearchParams(location.search).get("url");
    return q || localStorage.getItem(LAST_KEY) || DEFAULT_MARKS[0].url;
  });
  const [input, setInput] = useState(url);
  const [showMarks, setShowMarks] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
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
    // X-Frame-Options: многие сайты запрещают iframe — показываем честную подсказку.
    const t = setTimeout(() => setShowMarks(false), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="web-wrap">
      <div className="urlbar">
        <button className="btn ghost" disabled={!nav.back} onClick={() => step(-1)} title="Назад">
          ‹
        </button>
        <button className="btn ghost" disabled={!nav.fwd} onClick={() => step(1)} title="Вперёд">
          ›
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go(normalize(input))}
          placeholder="Адрес или поиск"
        />
        <button
          className="btn ghost"
          onClick={() => {
            // «Обновить»: тот же адрес — перезагрузка рамки (cross-origin safe:
            // просто переставляем src), другой ввод — переход/поиск.
            if (input.trim() === url) {
              const f = frameRef.current;
              if (f) f.src = url;
            } else {
              go(normalize(input));
            }
          }}
          title="Обновить"
        >
          ⟳
        </button>
        <button className="btn ghost" onClick={() => setShowMarks((x) => !x)} title="Закладки">
          ★
        </button>
        <a className="btn" href={url} target="_blank" rel="noreferrer" title="Открыть внешне">
          ↗
        </a>
      </div>
      {showMarks && (
        <div className="screen" style={{ maxHeight: "40dvh" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>Закладки</b>
            <button
              className="btn ghost"
              onClick={() => {
                const m = [...marks, { title: url.replace(/^https?:\/\//, "").split("/")[0], url }];
                setMarks(m);
                localStorage.setItem(MARKS_KEY, JSON.stringify(m));
              }}
            >
              ＋ Текущий сайт
            </button>
          </div>
          <div className="hr" />
          {[...marks].sort((a, b) => a.title.localeCompare(b.title, "ru")).map((m, i) => (
            <div key={i} className="list-item">
              <div className="grow" style={{ cursor: "pointer" }} onClick={() => go(m.url)}>
                <div className="t">{m.title}</div>
                <div className="muted">{m.url}</div>
              </div>
              <button
                className="btn ghost"
                onClick={() => {
                  const nm = marks.filter((_, j) => j !== i);
                  setMarks(nm);
                  localStorage.setItem(MARKS_KEY, JSON.stringify(nm));
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <iframe ref={frameRef} className="web-frame" src={url} title="web" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation" />
      <div className="panel muted" style={{ borderRadius: 0, margin: 0 }}>
        Если страница не открылась в рамке — сайт запрещает встраивание (X-Frame-Options/CSP). Нажмите ↗, чтобы открыть его во внешней вкладке.
      </div>
    </div>
  );
}
