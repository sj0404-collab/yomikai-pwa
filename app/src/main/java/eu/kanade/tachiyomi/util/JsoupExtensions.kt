package eu.kanade.tachiyomi.util

import okhttp3.Response
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import java.io.InputStream

/** Копия утилиты оригинала: ответ/поток -> jsoup Document. */
fun Response.asJsoup(html: String? = null): Document {
    return Jsoup.parse(html ?: body!!.string(), request.url.toString())
}

fun InputStream.asJsoup(url: String? = null): Document {
    return Jsoup.parse(this, "UTF-8", url ?: "")
}
