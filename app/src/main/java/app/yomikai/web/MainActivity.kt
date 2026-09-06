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
