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
        webFor(tab)
        views.forEach { (k, v) -> v.visibility = if (k == tab) View.VISIBLE else View.GONE }
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
        // Мосты для PWA: переходы между вкладками и нативная озвучка.
        wv.addJavascriptInterface(Bridge(), "AndroidShell")
        wv.addJavascriptInterface(TtsBridge(), "YomikaiTts")
        container.addView(wv)
        wv.loadUrl(BASE + tab + "/?shell=1")
        wv
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
        val wv = runCatching { views[current] }.getOrNull()
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
