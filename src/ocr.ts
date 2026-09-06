// OCR: tesseract.js подгружается с CDN только при первом скане — бандл не тяжелеет.
// Языки rus+eng (данные языков кэшируются браузером после первой загрузки).
declare global {
  interface Window {
    Tesseract?: any;
  }
}

let workerPromise: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("CDN недоступен — OCR офлайн не работает"));
    document.head.appendChild(s);
  });
}

async function getWorker(): Promise<any> {
  if (!workerPromise) {
    workerPromise = (async () => {
      if (!window.Tesseract) {
        await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
      }
      return await window.Tesseract.createWorker("rus+eng");
    })().catch((e) => {
      workerPromise = null; // следующая попытка — заново
      throw e;
    });
  }
  return workerPromise;
}

/** Распознать текст с картинки (URL/dataURI/элемент/canvas). */
export async function ocrImage(src: string | HTMLImageElement | HTMLCanvasElement): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(src as any);
  return String(data?.text || "").trim();
}

/** Обрезать область картинки (в долях 0..1) в canvas — для скана выбранной зоны. */
export function cropToCanvas(
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const scale = Math.min(3, Math.max(1, 1200 / Math.max(1, img.naturalWidth * w)));
  c.width = Math.max(1, Math.round(img.naturalWidth * w * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * h * scale));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    img,
    img.naturalWidth * x,
    img.naturalHeight * y,
    img.naturalWidth * w,
    img.naturalHeight * h,
    0,
    0,
    c.width,
    c.height,
  );
  return c;
}
