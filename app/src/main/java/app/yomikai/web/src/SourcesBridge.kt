package app.yomikai.web.src

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File

/**
 * Мост «источники» для React-оболочки: всё возвращает JSON-строки.
 * Вызовы источников блокирующие — мост и так работает на своём потоке.
 */
class SourcesBridge(private val ctx: Context) {

    @JavascriptInterface
    fun listSources(): String = runCatching {
        SourcesEngine.ensure(ctx); SourcesEngine.listSourcesJson()
    }.getOrDefault("""{"error":"engine"}""")

    @JavascriptInterface
    fun extensions(): String = runCatching {
        SourcesEngine.ensure(ctx); SourcesEngine.extensionsJson()
    }.getOrDefault("[]")

    @JavascriptInterface
    fun repoIndex(): String = runCatching { SourcesEngine.repoIndexJson() }.getOrDefault("[]")

    @JavascriptInterface
    fun popular(srcId: String, page: Int): String =
        safeRun { SourcesEngine.popularJson(ctx, srcId.toLong(), page) }

    @JavascriptInterface
    fun latest(srcId: String, page: Int): String =
        safeRun { SourcesEngine.latestJson(ctx, srcId.toLong(), page) }

    @JavascriptInterface
    fun search(srcId: String, page: Int, query: String): String =
        safeRun { SourcesEngine.searchJson(ctx, srcId.toLong(), page, query) }

    @JavascriptInterface
    fun chapters(srcId: String, mangaUrl: String, mangaTitle: String): String =
        safeRun { SourcesEngine.chaptersJson(ctx, srcId.toLong(), mangaUrl, mangaTitle) }

    @JavascriptInterface
    fun pages(srcId: String, chapterUrl: String, chapterName: String): String =
        safeRun { SourcesEngine.pagesJson(ctx, srcId.toLong(), chapterUrl, chapterName) }

    /** URL картинки через локальный прокси (Referer источника + CORS). */
    @JavascriptInterface
    fun proxy(image: String, referer: String): String =
        runCatching { ImageProxy.urlFor(image, referer) }.getOrDefault(image)

    /** Установить APK расширения (скачивание через DownloadManager, затем системная установка). */
    @JavascriptInterface
    fun installExtension(apkUrl: String): String = runCatching {
        val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val req = DownloadManager.Request(Uri.parse(apkUrl)).apply {
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalFilesDir(ctx, "Downloads", apkUrl.substringAfterLast('/').ifEmpty { "extension.apk" })
            setTitle("Установка расширения yomikai")
        }
        val id = dm.enqueue(req)
        """{"downloadId":$id}"""
    }.getOrDefault("""{"error":"download"}""")

    /** Открыть системную страницу приложения (для установки вручную). */
    @JavascriptInterface
    fun openInstaller(path: String): String = runCatching {
        val file = File(path)
        val uri = FileProvider.getUriForFile(ctx, "app.yomikai.web.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(intent)
        """{"ok":true}"""
    }.getOrDefault("""{"error":"install"}""")

    /** Скачать расширение окхом во внутреннее хранилище и открыть установщик. */
    @JavascriptInterface
    fun installExtensionDirect(apkUrl: String): String = runBlocking {
        runCatching {
            val client = NetworkHolder.get().client
            val resp = withContext(Dispatchers.IO) { client.newCall(Request.Builder().url(apkUrl).build()).execute() }
            resp.use { r ->
                val dir = File(ctx.cacheDir, "ext").apply { mkdirs() }
                val name = apkUrl.substringAfterLast('/').ifEmpty { "extension.apk" }
                val out = File(dir, name)
                r.body?.byteStream()?.use { input -> out.outputStream().use { input.copyTo(it) } }
                val uri = FileProvider.getUriForFile(ctx, "app.yomikai.web.fileprovider", out)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                """{"ok":true,"file":"${out.absolutePath}"}"""
            }
        }.getOrDefault("""{"error":"install"}""")
    }

    private fun safeRun(block: () -> String): String = runCatching(block)
        .getOrElse { """{"error":"${it.javaClass.simpleName}: ${it.message?.take(200) ?: ""}"}""" }
}
