import React, { useEffect, useMemo, useRef, useState } from "react";
import { getState, isModuleHidden, setState, useStore, CustomAction } from "../store";
import { AppBar, ToastHost } from "../ui";
import { speak, stop } from "../tts";
import { svgToCanvasSync, ocrImage } from "../ocr";

/** Демо-страницы: SVG с русскими репликами — их и озвучиваем, и распознаём OCR. */
function makePages(title: string, count: number) {
  const lines = [
    ["НЕУЖТО РИШЕЛЬЕ ВОЗНАМЕРИЛСЯ", "ОТКРЫТО ИГНОРИРОВАТЬ", "ВСЕ ТОРЖЕСТВА,"],
    ["ОН УЖЕ ГЛАВОЙ ЦЕРКВИ", "СЕБЯ ВОЗОМНИЛ, ЧТО ЛИ?"],
    ["КАК ЖЕ ВСЁ-ТАКИ РАЗДРАЖАЕТ", "ЕГО ИЗВЕЧНОЕ ВЫСОКОМЕРИЕ!"],
  ];
  return Array.from({ length: count }, (_, i) => {
    const ls = lines[i % lines.length];
    const text = ls.join(" ").toLowerCase();
    const bubble = ls
      .map((l, k) => `<text x="450" y="${150 + k * 44}" font-size="34" text-anchor="middle" font-family="Georgia, serif" fill="#111">${l}</text>`)
      .join("");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1300" viewBox="0 0 900 1300">` +
      `<rect width="900" height="1300" fill="#f7f3ea"/>` +
      `<rect x="60" y="60" width="780" height="520" fill="#d9c9a8"/>` +
      `<circle cx="330" cy="330" r="120" fill="#b98d6a"/>` +
      `<rect x="470" y="210" width="260" height="240" fill="#8a6f52"/>` +
      `<rect x="180" y="80" width="540" height="${90 + ls.length * 44}" rx="26" fill="#ffffff" stroke="#111" stroke-width="3"/>` +
      bubble +
      `<text x="450" y="1240" font-size="30" text-anchor="middle" fill="#666" font-family="Georgia, serif">${title} · стр. ${i + 1}</text>` +
      `</svg>`;
    return { svg, text };
  });
}

export function Reader(props: { title: string; pages: number; onExit: () => void; showToast: (t: string) => void }) {
  const state = useStore();
  const pages = useMemo(() => makePages(props.title, Math.max(1, props.pages)), [props.title, props.pages]);
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [hl, setHl] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<number | null>(null);

  useEffect(() => {
    setState({ history: [{ id: getState().library.find((l) => l.title === props.title)?.id ?? props.title, title: props.title, at: Date.now() }, ...getState().history].slice(0, 30) });
    return () => stop();
  }, []);

  const dir = state.readerDir;

  const doAutoscroll = () => {
    if (autoRef.current != null) {
      window.clearInterval(autoRef.current);
      autoRef.current = null;
      props.showToast("Автопрокрутка остановлена");
      return;
    }
    autoRef.current = window.setInterval(() => scrollRef.current?.scrollBy({ top: 3 }), 16);
    props.showToast("Автопрокрутка включена");
  };

  const doSpeakPage = () => {
    if (speaking) {
      stop();
      setSpeaking(false);
      setHl(false);
      return;
    }
    setSpeaking(true);
    setHl(true);
    speak(pages[index].text, () => {
      setSpeaking(false);
      setHl(false);
    });
  };

  const doOcr = async () => {
    setOcrBusy(true);
    setOcrText(null);
    try {
      const canvas = await svgToCanvasSync(pages[index].svg);
      const text = await ocrImage(canvas);
      setOcrText(text || "Не удалось распознать текст на странице");
    } catch (e: any) {
      setOcrText("OCR недоступен: " + (e?.message ?? "ошибка (оффлайн?)"));
    } finally {
      setOcrBusy(false);
    }
  };

  const applyAction = (a: CustomAction) => {
    switch (a.effect) {
      case "theme":
        setState({ theme: getState().theme === "dark" ? "light" : "dark" });
        props.showToast("Тема переключена");
        break;
      case "voice_preset":
        setState({ voiceGender: (a.value as any) || "auto" });
        props.showToast("Пресет голоса: " + (a.value || "auto"));
        break;
      case "reader_dir":
        setState({ readerDir: (a.value as any) || "rtl" });
        props.showToast("Порядок чтения: " + (a.value || "rtl"));
        break;
      case "tts_stop":
        stop();
        setSpeaking(false);
        props.showToast("Озвучка остановлена");
        break;
    }
  };

  const userActs = state.actions.filter((a) => a.placement === "floating_menu");
  const page = pages[index];
  const vertical = dir === "vertical";

  return (
    <div className="app">
      <AppBar title={props.title} back={props.onExit} right={<span className="muted">{index + 1} / {pages.length}</span>} />
      <div
        ref={scrollRef}
        className="content"
        style={{
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          direction: vertical ? "ltr" : dir === "rtl" ? "rtl" : "ltr",
          overflow: "auto",
          gap: 8,
        }}
      >
        {(vertical ? pages : [page]).map((p, i) => (
          <div key={i} className={"reader-page" + (speaking && hl && i === index ? " hl" : "")}>
            <img alt={"стр " + (i + 1)} src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(p.svg)} />
          </div>
        ))}
      </div>

      <div className="sao">
        {menuOpen && (
          <div className="sao-menu">
            {!isModuleHidden("r_order") && (
              <div className="sao-row">
                <span>{dir === "rtl" ? "→ Справа налево" : dir === "ltr" ? "→ Слева направо" : "↓ Сверху вниз"}</span>
                <button
                  className="sfab"
                  onClick={() => setState({ readerDir: dir === "rtl" ? "ltr" : dir === "ltr" ? "vertical" : "rtl" })}
                >⇄</button>
              </div>
            )}
            {!isModuleHidden("r_autoscroll") && (
              <div className="sao-row">
                <span>Автопрокрутка</span>
                <button className="sfab" onClick={doAutoscroll}>▶</button>
              </div>
            )}
            {!isModuleHidden("r_autoread") && (
              <div className="sao-row">
                <span>{speaking ? "Стоп чтения" : "Прочитать страницу"}</span>
                <button className="sfab" onClick={doSpeakPage}>🔊</button>
              </div>
            )}
            {!isModuleHidden("r_scan") && (
              <div className="sao-row">
                <span>OCR скан</span>
                <button className="sfab" onClick={doOcr}>⌕</button>
              </div>
            )}
            {userActs.map((a) => (
              <div className="sao-row" key={a.id}>
                <span>{a.title}</span>
                <button className="sfab" onClick={() => applyAction(a)}>★</button>
              </div>
            ))}
          </div>
        )}
        <button className="fab" onClick={() => setMenuOpen((v) => !v)}>{menuOpen ? "✕" : "☰"}</button>
      </div>

      {ocrBusy && <div className="toast">Распознавание… (закрытие = отмена)</div>}
      {ocrText != null && (
        <div className="dialog-back" onClick={() => setOcrText(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ whiteSpace: "pre-wrap" }}>{ocrText}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!isModuleHidden("r_tts") && <button className="chip" onClick={() => speak(ocrText)}>Голос</button>}
              <button className="chip" onClick={() => navigator.clipboard?.writeText(ocrText)}>Копировать</button>
              <button className="chip" onClick={() => setOcrText(null)}>Закрыть</button>
            </div>
            {state.actions.filter((a) => a.placement === "ocr_card").map((a) => (
              <button key={a.id} className="chip" onClick={() => applyAction(a)}>{a.title}</button>
            ))}
          </div>
        </div>
      )}

      {!vertical && (
        <div className="row" style={{ position: "sticky", bottom: 0, background: "var(--bg)" }}>
          <button className="sfab" onClick={() => setIndex((i) => Math.max(0, i - 1))}>⏮</button>
          <input
            type="range"
            min={0}
            max={pages.length - 1}
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <button className="sfab" onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}>⏭</button>
        </div>
      )}
    </div>
  );
}
