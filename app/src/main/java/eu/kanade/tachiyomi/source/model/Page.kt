package eu.kanade.tachiyomi.source.model

import android.net.Uri
import eu.kanade.tachiyomi.network.ProgressListener

open class Page(
    val index: Int,
    val url: String = "",
    var imageUrl: String? = null,
    @Transient var uri: Uri? = null, // Deprecated but can't be deleted due to extensions
) : ProgressListener {

    val number: Int
        get() = index + 1

    var status: State = State.Queue
    var progress: Int = 0

    override fun update(bytesRead: Long, contentLength: Long, done: Boolean) {
        progress = if (contentLength > 0) (100 * bytesRead / contentLength).toInt() else -1
    }

    sealed interface State {
        data object Queue : State
        data object LoadPage : State
        data object DownloadImage : State
        data object Ready : State
        data class Error(val error: Throwable) : State
    }
}
