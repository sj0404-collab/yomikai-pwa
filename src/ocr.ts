/**
 * OCR в PWA: tesseract.js подгружается динамически с CDN (в оффлайне OCR
 * недоступен — показываем понятное сообщение, приложение не падает).
 */
let loader: Promise<any> | null = null;

function loadTesseract(): Promise<any> {
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const w = window as any;
      if (w.Tesseract) return resolve(w.Tesseract);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = () => resolve(w.Tesseract);
      s.onerror = () => reject(new Error("tesseract.js не загрузился (оффлайн?)"));
      document.head.appendChild(s);
    });
  }
  return loader;
}

export async function ocrImage(source: HTMLImageElement | HTMLCanvasElement | string): Promise<string> {
  const Tesseract = await loadTesseract();
  const res = await Tesseract.recognize(source as any, "rus+eng");
  return String(res?.data?.text ?? "").trim();
}

/** SVG-страницуdemo рендерим в canvas, чтобы отдать в OCR и показать как картинку. */
export function svgToCanvas(svg: string, width = 900): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const img = new Image();
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    img.onload = () => {
      const scale = width / img.width;
      canvas.width = width;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  }) as any;
}

export function svgToCanvasSync(svg: string, width = 900): Promise<HTMLCanvasElement> {
  return svgToCanvas(svg as any, width) as Promise<HTMLCanvasElement>;
}
