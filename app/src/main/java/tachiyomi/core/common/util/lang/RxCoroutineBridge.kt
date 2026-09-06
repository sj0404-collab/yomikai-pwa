package tachiyomi.core.common.util.lang

import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import rx.Observable
import rx.Subscriber
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Bridge from RxJava1 Observable to suspend (копия семантики оригинала).
 */
suspend fun <T> Observable<T>.awaitSingle(): T = suspendCancellableCoroutine { continuation ->
    subscribe(awaitSingleSubscriber(continuation))
}

private fun <T> awaitSingleSubscriber(continuation: CancellableContinuation<T>): Subscriber<T> {
    return object : Subscriber<T>() {
        private var seenValue = false
        override fun onStart() { request(1) }
        override fun onNext(t: T) {
            seenValue = true
            continuation.resume(t)
        }
        override fun onError(e: Throwable) {
            if (!seenValue) continuation.resumeWithException(e)
        }
        override fun onCompleted() {
            if (!seenValue) continuation.resumeWithException(NoSuchElementException("Observable completed empty"))
        }
    }.apply {
        continuation.invokeOnCancellation { unsubscribe() }
    }
}

suspend fun <T> Observable<T>.awaitSingleResult(): T = awaitSingle()

suspend fun <T> Observable<List<T>>.awaitSingleOrNull(): List<T>? =
    runCatching { awaitSingle() }.getOrNull()
