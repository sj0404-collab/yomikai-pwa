package app.yomikai.web

import android.app.Application
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.util.Date

/**
 * Живучесть обёртки: любой необработанный exception пишется в crash.log
 * (filesDir + external files), следующий запуск показывает причину диалогом,
 * а не «молчаливым вылетом».
 */
class ShellApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val default = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            runCatching {
                val sw = StringWriter()
                e.printStackTrace(PrintWriter(sw))
                val txt = "=== ${Date()} thread=${t.name} ===\n$sw\n"
                File(filesDir, "crash.log").appendText(txt)
                getExternalFilesDir(null)?.let { File(it, "crash.log").appendText(txt) }
            }
            default?.uncaughtException(t, e)
        }
    }
}
