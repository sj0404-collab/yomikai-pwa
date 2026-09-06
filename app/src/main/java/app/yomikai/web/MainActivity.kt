package app.yomikai.web

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.bottomnavigation.BottomNavigationView

/**
 * yomikai web — APK-обёртка: вкладки нативные (Kotlin, Material BottomNavigation),
 * а содержимое каждой вкладки — своя PWA (TSX) с GitHub Pages, в своём WebView.
 * Сколько вкладок — столько и WebView/PWA, каждая отвечает за своё.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val BASE = "https://sj0404-collab.github.io/yomikai-pwa/"
        val TABS = listOf("library", "browse", "history", "reader", "web", "ai", "more")
    }

    private lateinit var container: FrameLayout
    private lateinit var nav: BottomNavigationView
    private val views = HashMap<String, WebView>()
    private var current = "library"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        container = findViewById(R.id.web_container)
        nav = findViewById(R.id.bottom_nav)
        nav.setOnItemSelectedListener { item ->
            selectTab(
                when (item.itemId) {
                    R.id.tab_library -> "library"
                    R.id.tab_browse -> "browse"
                    R.id.tab_history -> "history"
                    R.id.tab_reader -> "reader"
                    R.id.tab_web -> "web"
                    R.id.tab_ai -> "ai"
                    else -> "more"
                },
            )
            true
        }
        selectTab("library")
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
        // Мост для PWA: переход между вкладками из TSX-кода.
        wv.addJavascriptInterface(Bridge(), "AndroidShell")
        wv.addJavascriptInterface(TtsBridge(), "YomikaiTts")
        container.addView(wv)
        wv.loadUrl(BASE + tab + "/?shell=1")
        wv
    }

    fun selectTab(tab: String) {
        current = tab
        webFor(tab)
        views.forEach { (k, v) -> v.visibility = if (k == tab) View.VISIBLE else View.GONE }
        val id = when (tab) {
            "library" -> R.id.tab_library
            "browse" -> R.id.tab_browse
            "history" -> R.id.tab_history
            "reader" -> R.id.tab_reader
            "web" -> R.id.tab_web
            "ai" -> R.id.tab_ai
            else -> R.id.tab_more
        }
        if (nav.selectedItemId != id) nav.selectedItemId = id
    }

    /** JS-мост озвучки: Web Speech API в WebView отсутствует — нативный TextToSpeech. */
    inner class TtsBridge {
        private var tts: android.speech.tts.TextToSpeech? = null

        init {
            tts = android.speech.tts.TextToSpeech(this@MainActivity) { st ->
                if (st == android.speech.tts.TextToSpeech.SUCCESS) {
                    tts?.language = java.util.Locale("ru", "RU")
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun speak(text: String, gender: String, age: String, rate: Float, pitch: Float) {
            val t = tts ?: return
            val g = when (gender) { "male" -> 0.8f; "female" -> 1.16f; else -> 1.0f }
            val ap = when (age) { "infant" -> 1.85f; "child" -> 1.4f; "teen" -> 1.15f; "elderly" -> 0.82f; else -> 1.0f }
            val ar = when (age) { "infant" -> 0.9f; "child" -> 1.0f; "teen" -> 1.02f; "elderly" -> 0.92f; else -> 1.0f }
            t.setPitch((pitch * g * ap).coerceIn(0.3f, 2f))
            t.setSpeechRate((rate * ar).coerceIn(0.5f, 2f))
            t.speak(text, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, "yk_shell")
        }

        @android.webkit.JavascriptInterface
        fun stop() {
            tts?.stop()
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
                webFor(tab).loadUrl(BASE + tab + "/" + q)
            }
        }
    }

    @Deprecated("WebView back")
    override fun onBackPressed() {
        val wv = views[current]
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
