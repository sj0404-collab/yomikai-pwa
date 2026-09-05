import React, { useState } from "react";
import { isModuleHidden } from "../store";
import { AppBar } from "../ui";
import { ocrImage } from "../ocr";

/**
 * Браузер PWA: URL-бар + iframe. Многие сайты запрещают встраивание
 * (X-Frame-Options) — тогда показываем подсказку и кнопку «открыть в новой
 * вкладке». OCR — из файла картинки или из адресной строки-картинки.
 */
export function BrowserTab(props: { showToast: (t: string) => void }) {
  const [url, setUrl] = useState("https://example.com");
  const [loaded, setLoaded] = useState("https://example.com");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);

  const go = () => {
    let target = url.trim();
    if (!target) return;
    if (!/^https?:\/\//.test(target)) target = "https://" + target;
    setLoaded(target);
  };

  const ocrFile = async (file: File) => {
    setOcrBusy(true);
    setOcrText(null);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const text = await ocrImage(dataUrl);
      setOcrText(text || "Не удалось распознать текст на картинке");
    } catch (e: any) {
      setOcrText("OCR недоступен: " + (e?.message ?? "ошибка"));
    } finally {
      setOcrBusy(false);
    }
  };

  return (
    <>
      {!isModuleHidden("b_url") && (
        <AppBar
          title="Браузер"
          right={
            <label className="sfab" style={{ position: "relative", overflow: "hidden" }}>
              ⌕
              <input
                type="file"
                accept="image/*"
                style={{ position: "absolute", inset: 0, opacity: 0 }}
                onChange={(e) => e.target.files?.[0] && ocrFile(e.target.files[0])}
              />
            </label>
          }
        />
      )}
      {!isModuleHidden("b_url") && (
        <div className="row">
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="Адрес или поиск" />
          <button className="sfab" onClick={go}>→</button>
        </div>
      )}
      {ocrBusy && <div className="card">Распознавание… (tesseract.js, rus+eng)</div>}
      {ocrText != null && (
        <div className="card">
          <div style={{ whiteSpace: "pre-wrap" }}>{ocrText}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="chip" onClick={() => navigator.clipboard?.writeText(ocrText)}>Копировать</button>
            <button className="chip" onClick={() => setOcrText(null)}>Закрыть</button>
          </div>
        </div>
      )}
      {!isModuleHidden("b_frame") && (
        <iframe
          title="webview"
          src={loaded}
          style={{ width: "100%", height: "68vh", border: "none", background: "#fff" }}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      )}
      <div className="card muted">
        Если страница не отображается — сайт запрещает встраивание.{" "}
        <a href={loaded} target="_blank" rel="noreferrer">Открыть в новой вкладке</a>.
        OCR в браузере PWA работает из файла-картинки (кнопка ⌕ сверху).
      </div>
    </>
  );
}
