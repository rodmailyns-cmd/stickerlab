package com.stickerlab.app.whatsapp.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/**
 * Packs de stickers guardados en el almacenamiento interno de la app.
 *
 * Estructura en disco (dentro de `root`, normalmente `filesDir/wa-packs`):
 * ```
 * <identifier>/pack.json   metadatos + image_data_version
 * <identifier>/tray.png
 * <identifier>/01.webp …
 * ```
 * No usa APIs de Android para poder probarse en la JVM (ver android/jvm-tests).
 */
class StickerPackStore(private val root: File) {

    fun listPacks(): List<StickerPack> =
        (root.listFiles() ?: emptyArray())
            .filter { it.isDirectory && !it.name.startsWith(".") }
            .mapNotNull { readPack(it) }
            .sortedBy { it.name.lowercase() }

    fun getPack(identifier: String): StickerPack? =
        if (WaLimits.isValidIdentifier(identifier)) readPack(File(root, identifier)) else null

    /**
     * Valida y guarda un pack a partir de los archivos de `stagingDir` (escritos antes por la web).
     * Si el contenido cambió, incrementa `imageDataVersion` para que WhatsApp lo vuelva a leer.
     * La escritura es atómica: el pack anterior se mantiene si algo falla.
     */
    fun savePack(input: PackInput, stagingDir: File): StickerPack {
        val errors = validate(input, stagingDir)
        if (errors.isNotEmpty()) throw PackValidationException(errors)

        val files = listOf(input.trayImageFile) + input.stickers.map { it.imageFile }
        val hash = contentHash(input, files.map { File(stagingDir, it) })
        val previous = getPack(input.identifier)
        val version = when {
            previous == null -> 1
            previous.contentHash == hash -> previous.imageDataVersion
            else -> previous.imageDataVersion + 1
        }
        val pack = StickerPack(
            identifier = input.identifier,
            name = input.name.trim(),
            publisher = input.publisher.trim(),
            trayImageFile = input.trayImageFile,
            animated = input.animated,
            publisherEmail = input.publisherEmail,
            publisherWebsite = input.publisherWebsite,
            privacyPolicyWebsite = input.privacyPolicyWebsite,
            licenseAgreementWebsite = input.licenseAgreementWebsite,
            imageDataVersion = version,
            avoidCache = false,
            stickers = input.stickers,
            contentHash = hash,
        )

        root.mkdirs()
        val tmp = File(root, ".tmp-${input.identifier}-${System.nanoTime()}")
        try {
            tmp.mkdirs()
            for (name in files) File(stagingDir, name).copyTo(File(tmp, name), overwrite = true)
            File(tmp, PACK_JSON).writeText(pack.toJson().toString(2))
            val dest = File(root, input.identifier)
            val old = File(root, ".old-${input.identifier}-${System.nanoTime()}")
            if (dest.exists() && !dest.renameTo(old)) throw java.io.IOException("No se pudo reemplazar el pack anterior")
            if (!tmp.renameTo(dest)) {
                old.renameTo(dest)
                throw java.io.IOException("No se pudo guardar el pack")
            }
            old.deleteRecursively()
        } finally {
            tmp.deleteRecursively()
        }
        return pack
    }

    fun deletePack(identifier: String): Boolean =
        WaLimits.isValidIdentifier(identifier) && File(root, identifier).let { it.exists() && it.deleteRecursively() }

    /**
     * Archivo que se sirve para `stickers_asset/<identifier>/<fileName>`.
     * Solo devuelve archivos declarados en el pack (nada de rutas con `..`).
     */
    fun resolveAsset(identifier: String, fileName: String): File? {
        val pack = getPack(identifier) ?: return null
        val allowed = fileName == pack.trayImageFile || pack.stickers.any { it.imageFile == fileName }
        if (!allowed || fileName.contains('/') || fileName.contains("..")) return null
        val file = File(File(root, identifier), fileName)
        return if (file.isFile) file else null
    }

    /** Lista de problemas (en español) que impedirían que WhatsApp acepte el pack. */
    fun validate(input: PackInput, stagingDir: File): List<String> {
        val errors = mutableListOf<String>()
        if (!WaLimits.isValidIdentifier(input.identifier)) errors += "Identificador no válido: ${input.identifier}"
        if (input.name.isBlank() || input.name.length > WaLimits.MAX_NAME) errors += "El nombre debe tener entre 1 y ${WaLimits.MAX_NAME} caracteres"
        if (input.publisher.isBlank() || input.publisher.length > WaLimits.MAX_NAME) errors += "El autor debe tener entre 1 y ${WaLimits.MAX_NAME} caracteres"
        if (input.stickers.size !in WaLimits.MIN_STICKERS..WaLimits.MAX_STICKERS) {
            errors += "Un pack necesita entre ${WaLimits.MIN_STICKERS} y ${WaLimits.MAX_STICKERS} stickers (tiene ${input.stickers.size})"
        }
        val names = input.stickers.map { it.imageFile }
        if (names.toSet().size != names.size) errors += "Hay nombres de archivo repetidos"

        val tray = File(stagingDir, input.trayImageFile)
        if (!WaLimits.isSafeFileName(input.trayImageFile) || !tray.isFile) {
            errors += "Falta el icono de la bandeja"
        } else {
            val info = ImageInfo.read(tray)
            if (info?.format != ImageInfo.Format.PNG) errors += "El icono de la bandeja debe ser PNG"
            else if (info.width != info.height || info.width !in WaLimits.TRAY_MIN_SIZE..WaLimits.TRAY_MAX_SIZE) {
                errors += "El icono de la bandeja debe ser cuadrado (recomendado ${WaLimits.TRAY_SIZE}×${WaLimits.TRAY_SIZE})"
            }
            if (tray.length() > WaLimits.TRAY_MAX_BYTES) errors += "El icono de la bandeja pesa más de 50 KB"
        }

        input.stickers.forEachIndexed { i, s ->
            val label = "Sticker ${i + 1}"
            val f = File(stagingDir, s.imageFile)
            if (!WaLimits.isSafeFileName(s.imageFile) || !s.imageFile.endsWith(".webp") || !f.isFile) {
                errors += "$label: falta el archivo .webp"
                return@forEachIndexed
            }
            val info = ImageInfo.read(f)
            if (info?.format != ImageInfo.Format.WEBP) errors += "$label: no es un WebP válido"
            else {
                if (info.width != WaLimits.STICKER_SIZE || info.height != WaLimits.STICKER_SIZE) errors += "$label: debe medir 512×512"
                if (info.animated != input.animated) errors += "$label: no se pueden mezclar estáticos y animados"
                if (info.animated && info.durationMs > WaLimits.ANIMATED_MAX_DURATION_MS) errors += "$label: la animación dura más de 10 s"
            }
            val max = if (input.animated) WaLimits.ANIMATED_MAX_BYTES else WaLimits.STATIC_MAX_BYTES
            if (f.length() > max) errors += "$label: pesa ${f.length() / 1024} KB (máximo ${max / 1024} KB)"
            if (s.emojis.isEmpty() || s.emojis.size > WaLimits.MAX_EMOJIS) errors += "$label: necesita de 1 a ${WaLimits.MAX_EMOJIS} emojis"
        }
        return errors
    }

    private fun readPack(dir: File): StickerPack? {
        val json = File(dir, PACK_JSON)
        if (!json.isFile) return null
        return try {
            StickerPack.fromJson(JSONObject(json.readText()))
        } catch (e: Exception) {
            null
        }
    }

    private fun contentHash(input: PackInput, files: List<File>): String {
        val md = MessageDigest.getInstance("SHA-256")
        md.update(input.toJson().toString().toByteArray())
        for (f in files) {
            md.update(f.name.toByteArray())
            f.inputStream().use { s ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val n = s.read(buf)
                    if (n < 0) break
                    md.update(buf, 0, n)
                }
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    companion object {
        const val PACK_JSON = "pack.json"
    }
}

class PackValidationException(val errors: List<String>) : Exception(errors.joinToString("\n"))

data class StickerEntry(val imageFile: String, val emojis: List<String>, val accessibilityText: String = "") {
    fun toJson(): JSONObject = JSONObject()
        .put("image_file", imageFile)
        .put("emojis", JSONArray(emojis))
        .put("accessibility_text", accessibilityText)

    companion object {
        fun fromJson(o: JSONObject) = StickerEntry(
            imageFile = o.getString("image_file"),
            emojis = o.optJSONArray("emojis")?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList(),
            accessibilityText = o.optString("accessibility_text", ""),
        )
    }
}

/** Lo que manda la web al guardar un pack. */
data class PackInput(
    val identifier: String,
    val name: String,
    val publisher: String,
    val trayImageFile: String,
    val animated: Boolean,
    val stickers: List<StickerEntry>,
    val publisherEmail: String = "",
    val publisherWebsite: String = "",
    val privacyPolicyWebsite: String = "",
    val licenseAgreementWebsite: String = "",
) {
    fun toJson(): JSONObject = JSONObject()
        .put("identifier", identifier)
        .put("name", name)
        .put("publisher", publisher)
        .put("tray_image_file", trayImageFile)
        .put("animated_sticker_pack", animated)
        .put("publisher_email", publisherEmail)
        .put("publisher_website", publisherWebsite)
        .put("privacy_policy_website", privacyPolicyWebsite)
        .put("license_agreement_website", licenseAgreementWebsite)
        .put("stickers", JSONArray(stickers.map { it.toJson() }))

    companion object {
        /** Lee el formato de `contents.json` (un pack) que genera la web. */
        fun fromJson(o: JSONObject): PackInput {
            val st = o.getJSONArray("stickers")
            return PackInput(
                identifier = o.getString("identifier"),
                name = o.getString("name"),
                publisher = o.getString("publisher"),
                trayImageFile = o.getString("tray_image_file"),
                animated = o.optBoolean("animated_sticker_pack", false),
                stickers = (0 until st.length()).map { StickerEntry.fromJson(st.getJSONObject(it)) },
                publisherEmail = o.optString("publisher_email", ""),
                publisherWebsite = o.optString("publisher_website", ""),
                privacyPolicyWebsite = o.optString("privacy_policy_website", ""),
                licenseAgreementWebsite = o.optString("license_agreement_website", ""),
            )
        }
    }
}

data class StickerPack(
    val identifier: String,
    val name: String,
    val publisher: String,
    val trayImageFile: String,
    val animated: Boolean,
    val publisherEmail: String,
    val publisherWebsite: String,
    val privacyPolicyWebsite: String,
    val licenseAgreementWebsite: String,
    val imageDataVersion: Int,
    val avoidCache: Boolean,
    val stickers: List<StickerEntry>,
    val contentHash: String,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("identifier", identifier)
        .put("name", name)
        .put("publisher", publisher)
        .put("tray_image_file", trayImageFile)
        .put("animated_sticker_pack", animated)
        .put("publisher_email", publisherEmail)
        .put("publisher_website", publisherWebsite)
        .put("privacy_policy_website", privacyPolicyWebsite)
        .put("license_agreement_website", licenseAgreementWebsite)
        .put("image_data_version", imageDataVersion.toString())
        .put("avoid_cache", avoidCache)
        .put("content_hash", contentHash)
        .put("stickers", JSONArray(stickers.map { it.toJson() }))

    companion object {
        fun fromJson(o: JSONObject): StickerPack {
            val st = o.getJSONArray("stickers")
            return StickerPack(
                identifier = o.getString("identifier"),
                name = o.getString("name"),
                publisher = o.getString("publisher"),
                trayImageFile = o.getString("tray_image_file"),
                animated = o.optBoolean("animated_sticker_pack", false),
                publisherEmail = o.optString("publisher_email", ""),
                publisherWebsite = o.optString("publisher_website", ""),
                privacyPolicyWebsite = o.optString("privacy_policy_website", ""),
                licenseAgreementWebsite = o.optString("license_agreement_website", ""),
                imageDataVersion = o.optString("image_data_version", "1").toIntOrNull() ?: 1,
                avoidCache = o.optBoolean("avoid_cache", false),
                stickers = (0 until st.length()).map { StickerEntry.fromJson(st.getJSONObject(it)) },
                contentHash = o.optString("content_hash", ""),
            )
        }
    }
}
