// Мосты нативной обёртки (APK «yomikai web») для React-экранов.
// YomikaiSources — движок расширений оригинала (те же APK-источники);
// AndroidSite — навигация нативного сайт-WebView вкладки «Веб».
export type SourcesBridge = {
  listSources(): string;
  extensions(): string;
  repoIndex(): string;
  popular(id: string, page: number): string;
  latest(id: string, page: number): string;
  search(id: string, page: number, query: string): string;
  chapters(id: string, mangaUrl: string, mangaTitle: string): string;
  pages(id: string, chapterUrl: string, chapterName: string): string;
  proxy(image: string, referer: string): string;
  installExtension(apkUrl: string): string;
  installExtensionDirect(apkUrl: string): string;
};
export type SiteState = { url: string; title: string; canBack: boolean; canForward: boolean; progress: number };
export type SiteBridge = {
  nav(url: string): void;
  back(): void;
  forward(): void;
  reload(): void;
  stop(): void;
  state(): string;
  setBarHeight(dp: number): void;
};

export const srcBridge: SourcesBridge | null = ((window as any).YomikaiSources as SourcesBridge) ?? null;
export const siteBridge: SiteBridge | null = ((window as any).AndroidSite as SiteBridge) ?? null;

export type SrcInfo = { id: string; name: string; lang: string; supportsLatest: boolean; ext: string; nsfw: boolean };
export type MangaInfo = { url: string; title: string; author: string; artist: string; desc: string; genre: string; status: number; thumb: string; src: string; ref: string };
export type ChInfo = { url: string; name: string; date: number; num: number; scan: string };
export type PageInfo = { image: string; referer: string; n: number };
export type RepoExt = { name: string; pkg: string; apk: string; lang: string; version: string; code: number; nsfw: number; sources?: { name: string; lang: string }[] };

export function jp<T>(s: string): T {
  return JSON.parse(s) as T;
}

/** Картинка источника через локальный прокси обёртки (Referer + CORS для OCR). */
export function proxyUrl(img: string, referer: string): string {
  if (!img) return "";
  if (srcBridge) {
    try {
      return srcBridge.proxy(img, referer || "");
    } catch {
      /* мост недоступен — отдаём как есть */
    }
  }
  return img;
}

/** Индекс репозитория расширений — тот же, что использует оригинальный yomikai. */
export const REPO_INDEX_URL = "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json";
