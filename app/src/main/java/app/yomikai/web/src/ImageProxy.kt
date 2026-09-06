package app.yomikai.web.src

import eu.kanade.tachiyomi.network.GET
import okhttp3.OkHttpClient
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.net.URLEncoder

/**
 * Локальный прокси картинок источников: WebView-тег <img> не умеет слать
 * заголовки (Referer/User-Agent источника), поэтому изображения источников
 * отдаются через 127.0.0.1 нужным okhttp-клиентом. Отвечает с CORS-заголовком,
 * чтобы страницы можно было рисовать в canvas для OCR-сканера.
 */
object ImageProxy {
    private var port = 0

    @Synchronized
    fun start(clientProvider: () -> OkHttpClient): Int {
        if (port != 0) return port
        val server = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        port = server.localPort
        val t = Thread {
            while (true) {
                val sock = try { server.accept() } catch (e: Exception) { break }
                Thread { handle(sock, clientProvider) }.apply { isDaemon = true }.start()
            }
        }
        t.isDaemon = true
        t.name = "yomikai-imgproxy"
        t.start()
        return port
    }

    fun urlFor(image: String, referer: String): String {
        if (port == 0) return image
        if (image.startsWith("http://127.0.0.1")) return image
        val sb = StringBuilder("http://127.0.0.1:").append(port).append("/img?u=")
            .append(URLEncoder.encode(image, "UTF-8"))
        if (referer.isNotEmpty()) sb.append("&r=").append(URLEncoder.encode(referer, "UTF-8"))
        return sb.toString()
    }

    private fun handle(sock: Socket, clientProvider: () -> OkHttpClient) {
        sock.use { s ->
            try {
                s.soTimeout = 60_000
                val input = s.getInputStream()
                val head = StringBuilder()
                var prev = -1
                var c: Int
                while (input.read().also { c = it } != -1) {
                    if (prev == '\n'.code && c == '\r'.code) break
                    head.append(c.toChar())
                    prev = c
                }
                val line = head.toString().trim()
                val parts = line.split(" ")
                if (parts.size < 2 || parts[0] != "GET") return
                val q = parts[1]
                val query = q.substringAfter('?', "")
                val params = query.split('&').associate {
                    val kv = it.split('=', limit = 2)
                    URLDecoder.decode(kv[0], "UTF-8") to URLDecoder.decode(kv.getOrElse(1) { "" }, "UTF-8")
                }
                val url = params["u"] ?: return
                val referer = params["r"] ?: ""
                val client = clientProvider()
                val req = GET(url, headers = okhttp3.Headers.headersOf("Referer", referer))
                client.newCall(req).execute().use { resp ->
                    val body = resp.body ?: return
                    val out: OutputStream = s.getOutputStream()
                    val h = StringBuilder()
                    h.append("HTTP/1.1 ").append(resp.code).append(" ok\r\n")
                    h.append("Content-Type: ").append(resp.header("Content-Type") ?: "image/jpeg").append("\r\n")
                    h.append("Content-Length: ").append(resp.header("Content-Length") ?: "0").append("\r\n")
                    h.append("Access-Control-Allow-Origin: *\r\n")
                    h.append("Cache-Control: public, max-age=86400\r\n")
                    h.append("Connection: close\r\n\r\n")
                    out.write(h.toString().toByteArray(Charsets.ISO_8859_1))
                    body.byteStream().use { it.copyTo(out) }
                    out.flush()
                }
            } catch (_: Exception) {
            }
        }
    }
}
