package eu.kanade.tachiyomi.network

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import rx.Observable
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

val Call.isCanceled: Boolean
    get() = isCanceled()

fun Call.asObservable(): Observable<Response> {
    return Observable.unsafeCreate { subscriber ->
        enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (!subscriber.isUnsubscribed) subscriber.onError(e)
            }
            override fun onResponse(call: Call, response: Response) {
                if (!subscriber.isUnsubscribed) subscriber.onNext(response)
                if (!subscriber.isUnsubscribed) subscriber.onCompleted()
            }
        })
        subscriber.add(rx.subscriptions.Subscriptions.create { this@asObservable.cancel() })
    }
}

fun Call.asObservableSuccess(): Observable<Response> {
    return asObservable().doOnNext { response ->
        if (!response.isSuccessful) {
            response.close()
            throw HttpException(response.code)
        }
    }
}

suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            if (!continuation.isCancelled) continuation.resumeWithException(e)
        }
        override fun onResponse(call: Call, response: Response) {
            if (!continuation.isCancelled) continuation.resume(response)
        }
    })
    continuation.invokeOnCancellation { cancel() }
}

suspend fun Call.awaitSuccess(): Response {
    val response = await()
    if (!response.isSuccessful) {
        response.close()
        throw HttpException(response.code)
    }
    return response
}

fun OkHttpClient.newCachelessCallWithProgress(request: Request, listener: ProgressListener): Call {
    val client = newBuilder()
        .cache(null)
        .addNetworkInterceptor { chain ->
            val originalResponse = chain.proceed(chain.request())
            originalResponse.newBuilder()
                .body(originalResponse.body?.let { ProgressResponseBody(it, listener) })
                .build()
        }
        .build()
    return client.newCall(request)
}
