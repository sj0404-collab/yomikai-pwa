// Генерация отдельных manifest.webmanifest для каждой PWA-вкладки
// («сколько вкладок — столько и PWA, каждая отвечает за своё») + редирект с корня.
import { writeFileSync, mkdirSync } from "node:fs";

const TABS = [
  ["library", "Библиотека", "Сетка тайтлов, прогресс чтения, свои тайтлы"],
  ["browse", "Каталоги", "Источники и демо-тайтлы"],
  ["history", "История", "Последние открытые тайтлы"],
  ["reader", "Читалка", "Страницы, озвучка, OCR-скан зоны"],
  ["web", "Браузер", "Адрес, закладки RU, внешние ссылки"],
  ["ai", "AI-чат", "OpenAI-совместимый эндпоинт"],
  ["more", "Настройки", "Тема, озвучка, конструктор, данные"],
];

for (const [id, name, desc] of TABS) {
  mkdirSync(`public/${id}`, { recursive: true });
  writeFileSync(
    `public/${id}/manifest.webmanifest`,
    JSON.stringify(
      {
        name: `Yomikai · ${name}`,
        short_name: name,
        description: desc,
        lang: "ru",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#121417",
        theme_color: "#121417",
        icons: [{ src: "../icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      null,
      2,
    ),
  );
}

// Корень сайта — редирект в первую вкладку
writeFileSync(
  "public/index.html",
  `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=./library/" />
    <title>Yomikai</title>
  </head>
  <body>
    <a href="./library/">Yomikai · Библиотека</a>
  </body>
</html>
`,
);
console.log("manifests generated:", TABS.map((t) => t[0]).join(", "));
