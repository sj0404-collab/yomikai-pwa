package app.yomikai.web

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.File

/**
 * yomikai web — APK-обёртка: вкладки полностью нативные (Kotlin, своя панель без
 * лимита Material в 5 пунктов), содержимое каждой вкладки — своя PWA (TSX)
 * с GitHub Pages в своём WebView (пул: не перезагружаются при переключении).
 * Сколько вкладок — столько и PWA, каждая отвечает за своё.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val BASE = "https://sj0404-collab.github.io/yomikai-pwa/"
        val TABS = listOf("library", "browse", "history", "reader", "web", "ai", "more")
        private const val REQ_FILE = 22
    }

    private lateinit var container: FrameLayout
    private val views = HashMap<String, WebView>()
    private val tabViews = HashMap<String, View>()
    private var current = "library"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            setContentView(R.layout.activity_main)
            container = findViewById(R.id.web_container)
            buildTabBar()
            selectTab("library")
            showCrashLogIfAny()
        } catch (e: Throwable) {
            // Не вылетаем молча: причина — в crash.log + текст на экране.
            runCatching {
                File(filesDir, "crash.log").appendText("=== onCreate ===\n" + android.util.Log.getStackTraceString(e) + "\n")
            }
            val tv = TextView(this)
            tv.setPadding(32, 32, 32, 32)
            tv.text = "Ошибка запуска:\n$e\n\nПодробности записаны в crash.log — покажите скриншот разработчику."
            setContentView(tv)
        }
    }

    private fun iconFor(tab: String): Int = when (tab) {
        "library" -> R.drawable.ic_library
        "browse" -> R.drawable.ic_browse
        "history" -> R.drawable.ic_history
        "reader" -> R.drawable.ic_reader
        "web" -> R.drawable.ic_web
        "ai" -> R.drawable.ic_ai
        else -> R.drawable.ic_more
    }

    private fun labelFor(tab: String): String = when (tab) {
        "library" -> getString(R.string.tab_library)
        "browse" -> getString(R.string.tab_browse)
        "history" -> getString(R.string.tab_history)
        "reader" -> getString(R.string.tab_reader)
        "web" -> getString(R.string.tab_web)
        "ai" -> getString(R.string.tab_ai)
        else -> getString(R.string.tab_more)
    }

    /** Нативная панель вкладок: 7 кнопок (иконка + подпись), без BottomNavigationView. */
    private fun buildTabBar() {
        val row = findViewById<LinearLayout>(R.id.tab_bar)
        for (tab in TABS) {
            val v = layoutInflater.inflate(R.layout.tab_item, row, false)
            v.findViewById<ImageView>(R.id.tab_icon).setImageResource(iconFor(tab))
            v.findViewById<TextView>(R.id.tab_label).text = labelFor(tab)
            v.setOnClickListener { selectTab(tab) }
            tabViews[tab] = v
            row.addView(v)
        }
    }

    fun selectTab(tab: String) {
        if (!TABS.contains(tab)) return
        current = tab
        if (tab == "web") ensureSiteWv()
        webFor(tab)
        views.forEach { (k, v) -> v.visibility = if (k == tab) View.VISIBLE else View.GONE }
        siteWv?.visibility = if (tab == "web") View.VISIBLE else View.GONE
        val accent = getColor(R.color.accent)
        val muted = getColor(R.color.muted)
        tabViews.forEach { (k, v) ->
            val sel = k == tab
            v.findViewById<ImageView>(R.id.tab_icon).setColorFilter(if (sel) accent else muted)
            v.findViewById<TextView>(R.id.tab_label).setTextColor(if (sel) accent else muted)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun webFor(tab: String): WebView = views.getOrPut(tab) {
        val wv = WebView(this)
        wv.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        )
        wv.visibility = View.GONE
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
        }
        wv.webViewClient = WebViewClient()
        // Мосты для PWA: переходы между вкладками, нативная озвучка, источники.
        wv.addJavascriptInterface(Bridge(), "AndroidShell")
        wv.addJavascriptInterface(TtsBridge(), "YomikaiTts")
        wv.addJavascriptInterface(app.yomikai.web.src.SourcesBridge(this), "YomikaiSources")
        if (tab == "web") {
            // Режим тулбара: узкая PWA-полоса поверх нативного сайт-WebView.
            wv.addJavascriptInterface(WebSiteBridge(), "AndroidSite")
            (wv.layoutParams as FrameLayout.LayoutParams).apply {
                height = (56 * resources.displayMetrics.density).toInt()
                gravity = android.view.Gravity.TOP
            }
            wv.setBackgroundColor(android.graphics.Color.TRANSPARENT)
            wv.elevation = 12f
            container.addView(wv)
            wv.loadUrl(BASE + "web/?bar=1&shell=1")
        } else {
            container.addView(wv)
            wv.loadUrl(BASE + tab + "/?shell=1")
        }
        wv
    }

    // ---------- Вкладка «Веб» — как в оригинальном yomikai: нативный WebView сайта ----------
    private var siteWv: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    private fun ensureSiteWv() {
        if (siteWv != null) return
        val wv = WebView(this)
        wv.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        )
        wv.visibility = View.GONE
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)
        }
        wv.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                pushState()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                pushState()
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                pushState()
            }
        }
        wv.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) { pushState() }

            override fun onShowFileChooser(
                webView: WebView?,
                callback: android.webkit.ValueCallback<Array<android.net.Uri>>?,
                params: FileChooserParams?,
            ): Boolean {
                runCatching {
                    val intent = params?.createIntent() ?: return false
                    fileCb = callback
                    startActivityForResult(intent, REQ_FILE)
                }
                return true
            }
        }
        // Системные загрузки (как в оригинале): DownloadManager + уведомление.
        wv.setDownloadListener { url, ua, disposition, mime, _ ->
            runCatching {
                val dm = getSystemService(android.content.Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
                val req = android.app.DownloadManager.Request(android.net.Uri.parse(url)).apply {
                    setMimeType(mime)
                    addRequestHeader("User-Agent", ua ?: "")
                    setNotificationVisibility(
                        android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,
                    )
                    setDestinationInExternalPublicDir(
                        android.os.Environment.DIRECTORY_DOWNLOADS,
                        android.webkit.URLUtil.guessFileName(url, disposition, mime),
                    )
                }
                dm.enqueue(req)
            }
        }
        container.addView(wv)
        siteWv = wv
        // восстановить последний сайт (как в оригинале)
        val last = getSharedPreferences("shell", MODE_PRIVATE).getString("web_last", "") ?: ""
        wv.loadUrl(if (last.isNotBlank()) last else "https://duckduckgo.com")
    }

    private var fileCb: android.webkit.ValueCallback<Array<android.net.Uri>>? = null

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_FILE) {
            val uris = data?.data?.let { arrayOf(it) }
            fileCb?.onReceiveValue(uris)
            fileCb = null
        }
    }

    private fun pushState() {
        val wv = siteWv ?: return
        val ui = views["web"] ?: return
        val st = org.json.JSONObject().apply {
            put("url", wv.url ?: "")
            put("title", wv.title ?: "")
            put("canBack", wv.canGoBack())
            put("canForward", wv.canGoForward())
            put("progress", wv.progress)
        }
        getSharedPreferences("shell", MODE_PRIVATE).edit().putString("web_last", wv.url ?: "").apply()
        runOnUiThread {
            runCatching {
                ui.evaluateJavascript("window.onSiteState && window.onSiteState(${st})", null)
            }
        }
    }

    /** Мост тулбара вкладки «Веб»: навигация нативного сайт-WebView. */
    inner class WebSiteBridge {
        @android.webkit.JavascriptInterface
        fun nav(url: String) {
            var u = url.trim()
            if (u.isEmpty()) return
            if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://$u"
            runOnUiThread { runCatching { siteWv?.loadUrl(u) } }
        }

        @android.webkit.JavascriptInterface
        fun back() { runOnUiThread { runCatching { if (siteWv?.canGoBack() == true) siteWv?.goBack() } } }

        @android.webkit.JavascriptInterface
        fun forward() { runOnUiThread { runCatching { if (siteWv?.canGoForward() == true) siteWv?.goForward() } } }

        @android.webkit.JavascriptInterface
        fun reload() { runOnUiThread { runCatching { siteWv?.reload() } } }

        @android.webkit.JavascriptInterface
        fun stop() { runOnUiThread { runCatching { siteWv?.stopLoading() } } }

        @android.webkit.JavascriptInterface
        fun state(): String {
            val wv = siteWv ?: return "{}"
            return org.json.JSONObject().apply {
                put("url", wv.url ?: ""); put("title", wv.title ?: "")
                put("canBack", wv.canGoBack()); put("canForward", wv.canGoForward())
                put("progress", wv.progress)
            }.toString()
        }

        @android.webkit.JavascriptInterface
        fun setBarHeight(dp: Int) {
            runOnUiThread {
                runCatching {
                    val ui = views["web"] ?: return@runCatching
                    (ui.layoutParams as FrameLayout.LayoutParams).height =
                        (dp * resources.displayMetrics.density).toInt()
                    ui.requestLayout()
                }
            }
        }
    }

    /** Если прошлый запуск упал — показываем причину (crash.log), чтобы вылет
     *  не был «молчаливым»: скриншот диалога = готовый баг-репорт. */
    private fun showCrashLogIfAny() {
        val f = File(filesDir, "crash.log")
        if (!f.exists()) return
        if (System.currentTimeMillis() - f.lastModified() > 86_400_000L) {
            runCatching { f.delete() }
            return
        }
        val txt = runCatching { f.readText().take(1500) }.getOrDefault("")
        if (txt.isBlank()) return
        runCatching {
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("Прошлый запуск упал — причина:")
                .setMessage(txt)
                .setPositiveButton("Понятно") { d, _ ->
                    runCatching { f.delete() }
                    d.dismiss()
                }
                .setNegativeButton("Оставить лог") { d, _ -> d.dismiss() }
                .show()
        }
    }

    /** JS-мост озвучки: Web Speech API в WebView отсутствует — нативный TextToSpeech.
     *  Движок создаётся ЛЕНИВО (при первом speak), чтобы не тормозить и не рисковать на старте. */
    inner class TtsBridge {
        private var tts: android.speech.tts.TextToSpeech? = null

        private fun engine(): android.speech.tts.TextToSpeech? {
            if (tts == null) {
                tts = android.speech.tts.TextToSpeech(this@MainActivity) { st ->
                    if (st == android.speech.tts.TextToSpeech.SUCCESS) {
                        tts?.language = java.util.Locale("ru", "RU")
                    }
                }
            }
            return tts
        }

        @android.webkit.JavascriptInterface
        fun speak(text: String, gender: String, age: String, rate: Float, pitch: Float) {
            runOnUiThread {
                val t = engine() ?: return@runOnUiThread
                val g = when (gender) { "male" -> 0.8f; "female" -> 1.16f; else -> 1.0f }
                val ap = when (age) { "infant" -> 1.85f; "child" -> 1.4f; "teen" -> 1.15f; "elderly" -> 0.82f; else -> 1.0f }
                val ar = when (age) { "infant" -> 0.9f; "child" -> 1.0f; "teen" -> 1.02f; "elderly" -> 0.92f; else -> 1.0f }
                runCatching {
                    t.setPitch((pitch * g * ap).coerceIn(0.3f, 2f))
                    t.setSpeechRate((rate * ar).coerceIn(0.5f, 2f))
                    t.speak(text, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, "yk_shell")
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun stop() {
            runOnUiThread { runCatching { tts?.stop() } }
        }
    }

    /** JS-мост: PWA зовёт AndroidShell.openTab('reader', '?open=id'). */
    inner class Bridge {
        @android.webkit.JavascriptInterface
        fun openTab(tab: String, query: String) {
            runOnUiThread {
                if (!TABS.contains(tab)) return@runOnUiThread
                selectTab(tab)
                val q = if (query.contains("shell=1")) query else query + (if (query.isEmpty()) "?" else "&") + "shell=1"
                runCatching { webFor(tab).loadUrl(BASE + tab + "/" + q) }
            }
        }
    }

    @Deprecated("WebView back")
    override fun onBackPressed() {
        if (current == "web" && siteWv != null) {
            if (siteWv!!.canGoBack()) { siteWv!!.goBack() } else { @Suppress("DEPRECATION") super.onBackPressed() }
            return
        }
        val wv = runCatching { views[current] }.getOrNull()
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
