# yomikai web (shell)

APK-обёртка с собственным логотипом: **вкладки — нативный Kotlin**
(Material BottomNavigationView), **содержимое каждой вкладки — своя PWA (TSX)**
с https://sj0404-collab.github.io/yomikai-pwa/ (`/<tab>/?shell=1`), каждая в своём WebView
(пул: вкладка не перезагружается при переключении).

Сколько вкладок — столько и PWA: Библиотека, Каталоги, История, Читалка, Браузер, AI-чат, Ещё.
Мост `AndroidShell.openTab(tab, query)` позволяет TSX-коду переключать нативные вкладки.

Сборка: тег `shell-v*` → GitHub Actions → подписанный APK в Release.
Подпись: секреты SHELL_SIGNING_KEY / SHELL_KEY_STORE_PASSWORD / SHELL_ALIAS / SHELL_KEY_PASSWORD
(свой PKCS12-ключ, отдельный от основного yomikai).
