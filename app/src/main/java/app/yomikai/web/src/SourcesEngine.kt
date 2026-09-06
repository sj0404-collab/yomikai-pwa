package app.yomikai.web.src

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import eu.kanade.tachiyomi.network.NetworkHelper
import eu.kanade.tachiyomi.source.CatalogueSource
import eu.kanade.tachiyomi.source.Source
import eu.kanade.tachiyomi.source.SourceFactory
import eu.kanade.tachiyomi.source.model.SChapter
import eu.kanade.tachiyomi.source.model.SManga
import eu.kanade.tachiyomi.util.system.ChildFirstPathClassLoader
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject

/** Держатель NetworkHelper вместо injekt-DI оригинала. */
object NetworkHolder {
    private lateinit var helper: NetworkHelper
    fun init(context: Context) {
        if (!::helper.isInitialized) helper = NetworkHelper(context.applicationContext)
    }
    fun get(): NetworkHelper = helper
}

/**
 * Порт механики расширений оригинала (ExtensionLoader/AndroidSourceManager),
 * упрощённый до нужного обёртке: расширения — те же APK-пакеты с feature
 * «tachiyomi.extension», что установлены для основного yomikai, — источники
 * совместимы между APK.
 */
object SourcesEngine {

    private const val EXTENSION_FEATURE = "tachiyomi.extension"
    private const val METADATA_SOURCE_CLASS = "tachiyomi.extension.class"
    private const val METADATA_SOURCE_FACTORY = "tachiyomi.extension.factory"
    private const val METADATA_NSFW = "tachiyomi.extension.nsfw"
    private const val METADATA_CONTENT_WARNING = "tachiyomix.contentWarning"

    data class ExtInfo(
        val pkg: String,
        val name: String,
        val versionName: String,
        val nsfw: Boolean,
    )

    private val sourcesCache = HashMap<Long, Source>()
    private val extBySource = HashMap<Long, ExtInfo>()
    private var scanned = false

    @Suppress("DEPRECATION")
    fun scan(context: Context): List<ExtInfo> {
        val pm = context.packageManager
        val pkgs: List<PackageInfo> = try {
            pm.getInstalledPackages(PackageManager.GET_META_DATA or PackageManager.GET_CONFIGURATIONS)
        } catch (e: Exception) {
            emptyList()
        }
        return pkgs.mapNotNull { pkg ->
            val hasFeature = pkg.reqFeatures.orEmpty().any { it.name == EXTENSION_FEATURE } ||
                pkg.applicationInfo?.metaData?.containsKey(METADATA_SOURCE_CLASS) == true
            if (!hasFeature) return@mapNotNull null
            val meta = pkg.applicationInfo?.metaData
            val nsfw = (meta?.getInt(METADATA_CONTENT_WARNING, 0) ?: 0) > 0 ||
                (meta?.getInt(METADATA_NSFW, 0) ?: 0) == 1
            ExtInfo(
                pkg = pkg.packageName,
                name = pkg.applicationInfo?.loadLabel(pm)?.toString()?.removePrefix("Tachiyomi: ") ?: pkg.packageName,
                versionName = pkg.versionName ?: "",
                nsfw = nsfw,
            )
        }
    }

    /** Загрузить источники расширения через ChildFirstPathClassLoader (как оригинал). */
    private fun loadSources(context: Context, info: ExtInfo): List<Source> {
        val pm = context.packageManager
        val pkgInfo = pm.getPackageInfo(info.pkg, PackageManager.GET_META_DATA)
        val appInfo = pkgInfo.applicationInfo ?: return emptyList()
        val meta = appInfo.metaData ?: return emptyList()
        val loader = ChildFirstPathClassLoader(appInfo.sourceDir, null, context.classLoader)
        val out = mutableListOf<Source>()
        val factoryClass = meta.getString(METADATA_SOURCE_FACTORY)
        val sourceClass = meta.getString(METADATA_SOURCE_CLASS)
        val classNames = if (!factoryClass.isNullOrEmpty()) {
            listOf(factoryClass)
        } else if (!sourceClass.isNullOrEmpty()) {
            sourceClass.split(";")
        } else {
            emptyList()
        }
        for (cn in classNames) {
            runCatching {
                val cls = loader.loadClass(cn)
                val obj = cls.getDeclaredConstructor().newInstance()
                when (obj) {
                    is SourceFactory -> out.addAll(obj.createSources())
                    is Source -> out.add(obj)
                }
            }
        }
        return out
    }

    fun ensure(context: Context) {
        if (scanned) return
        scanned = true
        for (info in scan(context)) {
            for (s in runCatching { loadSources(context, info) }.getOrDefault(emptyList())) {
                sourcesCache[s.id] = s
                extBySource[s.id] = info
            }
        }
    }

    fun source(id: Long): Source? = sourcesCache[id]

    fun baseUrl(id: Long): String = runCatching {
        val s = sourcesCache[id] ?: return ""
        val m = s.javaClass.getMethod("getBaseUrl")
        m.invoke(s) as? String ?: ""
    }.getOrDefault("")

    fun listSourcesJson(): String {
        val arr = JSONArray()
        sourcesCache.values.sortedWith(compareBy({ it.lang }, { it.name })).forEach { s ->
            arr.put(
                JSONObject().apply {
                    put("id", s.id.toString())
                    put("name", s.name)
                    put("lang", s.lang)
                    put("supportsLatest", s.supportsLatest)
                    put("ext", extBySource[s.id]?.pkg ?: "")
                    put("nsfw", extBySource[s.id]?.nsfw == true)
                },
            )
        }
        return arr.toString()
    }

    fun extensionsJson(): String {
        val arr = JSONArray()
        extBySource.values.distinctBy { it.pkg }.forEach { e ->
            arr.put(
                JSONObject().apply {
                    put("pkg", e.pkg); put("name", e.name)
                    put("version", e.versionName); put("nsfw", e.nsfw)
                },
            )
        }
        return arr.toString()
    }

    // ---- вызовы источников (suspend в оригинале) ----
    private fun mangaJson(m: SManga, id: Long): JSONObject = JSONObject().apply {
        put("url", m.url); put("title", m.title); put("author", m.author ?: "")
        put("artist", m.artist ?: ""); put("desc", m.description ?: "")
        put("genre", m.genre ?: ""); put("status", m.status); put("thumb", m.thumbnail_url ?: "")
        put("src", id.toString()); put("ref", baseUrl(id))
    }

    fun popularJson(context: Context, id: Long, page: Int): String {
        ensure(context)
        val s = sourcesCache[id] as? CatalogueSource ?: return """{"error":"source not found"}"""
        val r = runBlocking { s.getPopularManga(page) }
        return JSONObject().apply {
            put("hasNext", r.hasNextPage)
            put("items", JSONArray().apply { r.mangas.forEach { put(mangaJson(it, id)) } })
        }.toString()
    }

    fun latestJson(context: Context, id: Long, page: Int): String {
        ensure(context)
        val s = sourcesCache[id] as? CatalogueSource ?: return """{"error":"source not found"}"""
        val r = runBlocking { s.getLatestUpdates(page) }
        return JSONObject().apply {
            put("hasNext", r.hasNextPage)
            put("items", JSONArray().apply { r.mangas.forEach { put(mangaJson(it, id)) } })
        }.toString()
    }

    fun searchJson(context: Context, id: Long, page: Int, query: String): String {
        ensure(context)
        val s = sourcesCache[id] as? CatalogueSource ?: return """{"error":"source not found"}"""
        val r = runBlocking { s.getSearchManga(page, query, s.getFilterList()) }
        return JSONObject().apply {
            put("hasNext", r.hasNextPage)
            put("items", JSONArray().apply { r.mangas.forEach { put(mangaJson(it, id)) } })
        }.toString()
    }

    fun chaptersJson(context: Context, id: Long, mangaUrl: String, mangaTitle: String): String {
        ensure(context)
        val s = sourcesCache[id] ?: return """{"error":"source not found"}"""
        val manga = SManga.create().apply { url = mangaUrl; title = mangaTitle }
        val upd = runBlocking { s.getMangaUpdate(manga, emptyList(), fetchDetails = true, fetchChapters = true) }
        val chapters: List<SChapter> = upd.chapters
        return JSONArray().apply {
            chapters.forEachIndexed { i, ch ->
                put(
                    JSONObject().apply {
                        put("url", ch.url); put("name", ch.name); put("date", ch.date_upload)
                        put("num", chapters.size - i); put("scan", ch.scanlator ?: "")
                    },
                )
            }
        }.toString()
    }

    fun pagesJson(context: Context, id: Long, chapterUrl: String, chapterName: String): String {
        ensure(context)
        val s = sourcesCache[id] ?: return """{"error":"source not found"}"""
        val ch = SChapter.create().apply { url = chapterUrl; name = chapterName }
        val pages = runBlocking { s.getPageList(ch) }
        val referer = baseUrl(id)
        return JSONArray().apply {
            pages.forEach { p ->
                put(
                    JSONObject().apply {
                        put("image", p.imageUrl ?: p.url); put("referer", referer); put("n", p.number)
                    },
                )
            }
        }.toString()
    }

    /** Репозиторий расширений — тот же индекс, что использует оригинал. */
    fun repoIndexJson(): String {
        return runCatching {
            val client = NetworkHolder.get().client
            val req = okhttp3.Request.Builder()
                .url("https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json")
                .build()
            client.newCall(req).execute().use { r -> r.body?.string() ?: "[]" }
        }.getOrDefault("[]")
    }
}
