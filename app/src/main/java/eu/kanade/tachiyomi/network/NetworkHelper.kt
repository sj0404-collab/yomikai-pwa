package eu.kanade.tachiyomi.network

import android.content.Context
import eu.kanade.tachiyomi.network.interceptor.UserAgentInterceptor
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Упрощённый порт оригинального NetworkHelper: те же публичные члены,
 * которые использует HttpSource расширений (client, cloudflareClient,
 * defaultUserAgentProvider). Куки живут в памяти процесса.
 */
class NetworkHelper(context: Context) {

    val cookies = AndroidCookieJar()

    val defaultUserAgentProvider: () -> String = {
        System.getProperty("http.agent") ?: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    }

    val client: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(cookies)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(UserAgentInterceptor(defaultUserAgentProvider))
        .followRedirects(true)
        .build()

    @Deprecated("The regular client handles Cloudflare by default")
    val cloudflareClient: OkHttpClient = client

    @Suppress("UNUSED")
    val disabledCookiesClient: OkHttpClient = client.newBuilder()
        .cookieJar(okhttp3.CookieJar.NO_COOKIES)
        .build()
}
