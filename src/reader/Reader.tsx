import React, { useEffect, useRef, useState } from "react";
import { setState, getState, type LibItem } from "../store";
import { speakText, stopTts, isSpeaking, GENDER_LABEL, AGE_LABEL, type Gender, type Age } from "../tts";
import { ocrImage, cropToCanvas } from "../ocr";

// Читалка: страница-картинка + SAO-меню (порядок чтения, автопрокрутка,
// «прочитать страницу», OCR-скан зоны пальцем, озвучка пресетами пол×возраст).
export default function Reader({ item }: { item: LibItem | null }) {
  const [page, setPage] = useState(item?.lastPage ?? 0);
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<"rtl" | "ltr" | "vertical">(getState().settings.readerMode);
  const [autoScroll, setAutoScroll] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrSent, setOcrSent] = useState(-1);
  const [picking, setPicking] = useState(false);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [gender, setGender] = useState<Gender>("neutral");
  const [age, setAge] = useState<Age>("adult");
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (item) setPage(Math.min(item.lastPage, Math.max(0, item.pages.length - 1)));
    stopTts();
    setOcrText(null);
  }, [item?.id]);

  useEffect(() => {
    if (item) setState((s) => s.library.forEach((l) => (l.id === item.id ? (l.lastPage = page) : null)));
  }, [page, item?.id]);

  // Автопрокрутка (вертикальный режим)
  useEffect(() => {
    if (!autoScroll || mode !== "vertical") return;
    const el = wrapRef.current;
    if (!el) return;
    const t = setInterval(() => {
      el.scrollBy({ top: 2, behavior: "auto" });
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setAutoScroll(false);
    }, 16);
    return () => clearInterval(t);
  }, [autoScroll, mode]);

  if (!item) {
    return (
      <div className="screen">
        <div className="topbar">
          <h1>Читалка</h1>
        </div>
        <div className="panel muted">Откройте тайтл из Библиотеки или Истории.</div>
      </div>
    );
  }
  if (item.pages.length === 0) {
    return (
      <div className="screen">
        <div className="topbar">
          <h1>{item.title}</h1>
        </div>
        <AddPages item={item} />
      </div>
    );
  }

  const p = item.pages[Math.min(page, item.pages.length - 1)];

  const turn = (d: number) => {
    stopTts();
    setOcrText(null);
    setPage((x) => Math.min(item.pages.length - 1, Math.max(0, x + d)));
  };

  const readPage = () => {
    const text = ocrText || p.text;
    if (!text) return;
    speakText(text, { gender, age, onSentence: (i) => setOcrSent(i), onEnd: () => setOcrSent(-1) });
  };

  const scanArea = async (x: number, y: number, w: number, h: number) => {
    const img = imgRef.current;
    if (!img) return;
    setOcrBusy(true);
    setOcrText(null);
    try {
      const canvas = cropToCanvas(img, x, y, w, h);
      const txt = await ocrImage(canvas);
      setOcrText(txt || "Ничего не распознано");
    } catch (e: any) {
      setOcrText("OCR недоступен: " + (e?.message || e));
    } finally {
      setOcrBusy(false);
      setPicking(false);
      setRect(null);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!picking) return;
    const r = wrapRef.current!.getBoundingClientRect();
    dragStart.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    setRect({ x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!picking || !dragStart.current) return;
    const r = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setRect({
      x: Math.min(x, dragStart.current.x),
      y: Math.min(y, dragStart.current.y),
      w: Math.abs(x - dragStart.current.x),
      h: Math.abs(y - dragStart.current.y),
    });
  };
  const onPointerUp = () => {
    if (!picking || !dragStart.current || !rect || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const img = imgRef.current;
    dragStart.current = null;
    if (!img || rect.w < 20 || rect.h < 20) {
      setRect(null);
      return;
    }
    // координаты выделения (отн. обёртки) -> доли картинки
    const ir = img.getBoundingClientRect();
    const fx = (rect.x - (ir.left - r.left)) / ir.width;
    const fy = (rect.y - (ir.top - r.top)) / ir.height;
    scanArea(Math.max(0, fx), Math.max(0, fy), rect.w / ir.width, rect.h / ir.height);
  };

  const sentences = (ocrText || p.text || "").split(/(?<=[.!?…])\s+/).filter(Boolean);

  return (
    <div className="reader">
      <div
        ref={wrapRef}
        className={"reader-imgs" + (mode === "vertical" ? "" : " horizontal" + (mode === "rtl" ? " rtl" : ""))}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ touchAction: picking ? "none" : undefined }}
      >
        {mode === "vertical" ? (
          <img ref={imgRef} src={p.img} alt="" draggable={false} crossOrigin={p.img.startsWith("http://127.0.0.1") ? "anonymous" : undefined} />
        ) : (
          item.pages.map((pg, i) => (
            <img key={i} ref={i === page ? imgRef : undefined} src={pg.img} alt="" draggable={false} crossOrigin={pg.img.startsWith("http://127.0.0.1") ? "anonymous" : undefined} onClick={() => !picking && setPage(i)} />
          ))
        )}
        {rect && <div className="sel-rect" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      </div>

      {picking && <div className="area-hint">Выделите зону пальцем — отпустите для скана</div>}

      {ocrBusy && (
        <div className="ocr-card">
          <b>Распознавание…</b>
          <div className="muted">tesseract.js: при первом скане докачает языковые данные (~2 МБ, закэшируется).</div>
        </div>
      )}
      {!ocrBusy && ocrText !== null && (
        <div className="ocr-card">
          <div>
            {sentences.map((s, i) => (
              <span key={i} className={i === ocrSent ? "sent-cur" : ""}>
                {s}{" "}
              </span>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn ghost" onClick={readPage}>
              {isSpeaking() ? "⟳ Заново" : "🔊 Голос"}
            </button>
            <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(ocrText || "")}>
              Копир.
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                stopTts();
                setOcrText(null);
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {mode !== "vertical" && (
        <>
          <button className="sao-fab" style={{ left: 12, right: undefined }} onClick={() => turn(mode === "rtl" ? 1 : -1)}>
            ‹
          </button>
          <button className="sao-fab" style={{ right: 66 }} onClick={() => turn(mode === "rtl" ? -1 : 1)}>
            ›
          </button>
        </>
      )}
      <button className="sao-fab" onClick={() => setMenu((m) => !m)}>
        ☰
      </button>

      {menu && (
        <div className="sao-menu">
          <b>{item.title}</b>
          <div className="muted">
            стр. {page + 1}/{item.pages.length}
          </div>
          <div className="hr" />
          <div className="chips">
            {(["rtl", "ltr", "vertical"] as const).map((m) => (
              <button
                key={m}
                className={"chip" + (mode === m ? " active" : "")}
                onClick={() => {
                  setMode(m);
                  setState((s) => (s.settings.readerMode = m));
                }}
              >
                {m === "rtl" ? "Справа налево" : m === "ltr" ? "Слева направо" : "Вертикаль"}
              </button>
            ))}
          </div>
          <div className="hr" />
          <div className="row">
            <button className={"chip" + (autoScroll ? " active" : "")} onClick={() => setAutoScroll((a) => !a)} disabled={mode !== "vertical"}>
              Автопрокрутка
            </button>
            <button className="chip" onClick={() => setPicking((x) => !x)}>
              {picking ? "Отмена выбора" : "✂ Скан зоны"}
            </button>
            <button className="chip" onClick={readPage}>
              🔊 Прочитать страницу
            </button>
          </div>
          <div className="hr" />
          <div className="muted">Голос-пресет:</div>
          <div className="chips" style={{ marginTop: 4 }}>
            {(["female", "male", "neutral"] as Gender[]).map((g) => (
              <button key={g} className={"chip" + (gender === g ? " active" : "")} onClick={() => setGender(g)}>
                {GENDER_LABEL[g]}
              </button>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 4 }}>
            {(Object.keys(AGE_LABEL) as Age[]).map((a) => (
              <button key={a} className={"chip" + (age === a ? " active" : "")} onClick={() => setAge(a)}>
                {AGE_LABEL[a]}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn ghost" onClick={() => speakText("Раз, два, три — проверка голоса.", { gender, age })}>
              ▶ Проба
            </button>
            <button className="btn ghost" onClick={stopTts}>
              ■ Стоп
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPages({ item }: { item: LibItem }) {
  const [urls, setUrls] = useState("");
  return (
    <div className="panel">
      <div className="muted">Страниц пока нет. Вставьте URL картинок (по одной на строку) или выберите файлы:</div>
      <textarea rows={4} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={"https://…/page1.jpg\nhttps://…/page2.jpg"} />
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn"
          onClick={() => {
            const list = urls.split("\n").map((x) => x.trim()).filter(Boolean);
            if (list.length === 0) return;
            setState((s) =>
              s.library.forEach((l) => {
                if (l.id === item.id) {
                  l.pages = list.map((u) => ({ img: u, text: "" }));
                  l.cover = list[0];
                }
              }),
            );
          }}
        >
          Добавить страницы
        </button>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            const pages = await Promise.all(
              files.map(
                (f) =>
                  new Promise<{ img: string; text: string }>((res) => {
                    const r = new FileReader();
                    r.onload = () => res({ img: String(r.result), text: "" });
                    r.readAsDataURL(f);
                  }),
              ),
            );
            setState((s) =>
              s.library.forEach((l) => {
                if (l.id === item.id) {
                  l.pages = pages;
                  l.cover = pages[0].img;
                }
              }),
            );
          }}
        />
      </div>
    </div>
  );
}
