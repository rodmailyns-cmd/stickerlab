package com.stickerlab.app.whatsapp

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.stickerlab.app.BuildConfig
import com.stickerlab.app.whatsapp.core.PackInput
import com.stickerlab.app.whatsapp.core.PackValidationException
import com.stickerlab.app.whatsapp.core.StickerPack
import com.stickerlab.app.whatsapp.core.WaLimits
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

/**
 * Puente entre la web y WhatsApp.
 *
 * - `getStatus`      ¿Está instalado WhatsApp / WhatsApp Business?
 * - `savePack`       Valida y guarda un pack (archivos escritos antes en `filesDir/wa-staging/<id>`).
 * - `addToWhatsApp`  Lanza el intent oficial `ENABLE_STICKER_PACK`.
 * - `isPackAdded`    Pregunta a WhatsApp si el pack ya está añadido.
 * - `listPacks` / `deletePack`
 * - `saveToDevice`   Guarda un archivo en la galería (Imágenes) o en Descargas.
 */
@CapacitorPlugin(
    name = "WhatsAppStickers",
    permissions = [Permission(alias = WhatsAppStickersPlugin.STORAGE, strings = [Manifest.permission.WRITE_EXTERNAL_STORAGE])],
)
class WhatsAppStickersPlugin : Plugin() {

    private val store by lazy { StickerContentProvider.packStore(context.filesDir) }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val consumer = WhatsAppHelper.isInstalled(context, WhatsAppHelper.CONSUMER)
        val business = WhatsAppHelper.isInstalled(context, WhatsAppHelper.BUSINESS)
        call.resolve(JSObject().put("consumer", consumer).put("business", business).put("installed", consumer || business))
    }

    @PluginMethod
    fun savePack(call: PluginCall) {
        val packJson = call.getObject("pack") ?: return call.reject("Falta el pack", "INVALID")
        val stagingName = call.getString("stagingDir") ?: return call.reject("Falta stagingDir", "INVALID")
        if (stagingName.contains("..")) return call.reject("Ruta no válida", "INVALID")
        val staging = File(context.filesDir, stagingName)
        try {
            val input = PackInput.fromJson(JSONObject(packJson.toString()))
            val pack = store.savePack(input, staging)
            staging.deleteRecursively()
            call.resolve(packToJs(pack))
        } catch (e: PackValidationException) {
            call.reject(e.errors.joinToString("\n"), "VALIDATION_ERROR", e, JSObject().put("errors", JSArray(e.errors)))
        } catch (e: Exception) {
            call.reject("No se pudo guardar el pack: ${e.message}", "IO_ERROR", e)
        }
    }

    @PluginMethod
    fun listPacks(call: PluginCall) {
        val arr = JSArray()
        store.listPacks().forEach { arr.put(packToJs(it)) }
        call.resolve(JSObject().put("packs", arr))
    }

    @PluginMethod
    fun deletePack(call: PluginCall) {
        val id = call.getString("identifier") ?: return call.reject("Falta el identificador", "INVALID")
        call.resolve(JSObject().put("deleted", store.deletePack(id)))
    }

    @PluginMethod
    fun isPackAdded(call: PluginCall) {
        val id = call.getString("identifier") ?: return call.reject("Falta el identificador", "INVALID")
        val consumer = WhatsAppHelper.isPackWhitelisted(context, WhatsAppHelper.CONSUMER, id)
        val business = WhatsAppHelper.isPackWhitelisted(context, WhatsAppHelper.BUSINESS, id)
        call.resolve(JSObject().put("consumer", consumer).put("business", business).put("added", consumer || business))
    }

    @PluginMethod
    fun addToWhatsApp(call: PluginCall) {
        val id = call.getString("identifier") ?: return call.reject("Falta el identificador", "INVALID")
        val pack = store.getPack(id) ?: return call.reject("El pack no está guardado en el teléfono", "NOT_FOUND")
        val consumer = WhatsAppHelper.isInstalled(context, WhatsAppHelper.CONSUMER)
        val business = WhatsAppHelper.isInstalled(context, WhatsAppHelper.BUSINESS)
        if (!consumer && !business) return call.reject("WhatsApp no está instalado", "NOT_INSTALLED")

        val target = call.getString("target") // "consumer" | "business" | null (preguntar)
        val base = Intent(WhatsAppHelper.ACTION_ENABLE_STICKER_PACK).apply {
            putExtra(WhatsAppHelper.EXTRA_STICKER_PACK_ID, pack.identifier)
            putExtra(WhatsAppHelper.EXTRA_STICKER_PACK_AUTHORITY, BuildConfig.CONTENT_PROVIDER_AUTHORITY)
            putExtra(WhatsAppHelper.EXTRA_STICKER_PACK_NAME, pack.name)
        }
        val intent = when {
            target == "consumer" && consumer -> base.setPackage(WhatsAppHelper.CONSUMER)
            target == "business" && business -> base.setPackage(WhatsAppHelper.BUSINESS)
            consumer && business -> Intent.createChooser(base, "Añadir a WhatsApp")
            consumer -> base.setPackage(WhatsAppHelper.CONSUMER)
            else -> base.setPackage(WhatsAppHelper.BUSINESS)
        }
        try {
            startActivityForResult(call, intent, "onAddResult")
        } catch (e: ActivityNotFoundException) {
            call.reject("Tu versión de WhatsApp no admite packs de otras apps. Actualízala desde Play Store.", "NOT_SUPPORTED", e)
        }
    }

    @ActivityCallback
    private fun onAddResult(call: PluginCall?, result: ActivityResult) {
        call ?: return
        val id = call.getString("identifier") ?: ""
        val validationError = result.data?.getStringExtra(WhatsAppHelper.EXTRA_VALIDATION_ERROR)
        when {
            result.resultCode == Activity.RESULT_OK -> call.resolve(JSObject().put("added", true))
            validationError != null -> call.reject(validationError, "VALIDATION_ERROR")
            else -> {
                // Al cancelar, WhatsApp no distingue "ya estaba añadido": lo comprobamos
                val added = WhatsAppHelper.isPackWhitelisted(context, WhatsAppHelper.CONSUMER, id) ||
                    WhatsAppHelper.isPackWhitelisted(context, WhatsAppHelper.BUSINESS, id)
                call.resolve(JSObject().put("added", added).put("cancelled", !added))
            }
        }
    }

    /**
     * Guarda un archivo en la galería o en Descargas.
     * Opciones: `path` (relativo a la carpeta de datos de la app) o `data` (base64), `fileName`, `mimeType`,
     * `collection` = "pictures" | "downloads".
     */
    @PluginMethod
    fun saveToDevice(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState(STORAGE) != PermissionState.GRANTED) {
            requestPermissionForAlias(STORAGE, call, "onStoragePermission")
            return
        }
        doSave(call)
    }

    @PermissionCallback
    private fun onStoragePermission(call: PluginCall) {
        if (getPermissionState(STORAGE) == PermissionState.GRANTED) doSave(call)
        else call.reject("Necesito permiso de almacenamiento para guardar el archivo", "PERMISSION_DENIED")
    }

    private fun doSave(call: PluginCall) {
        val fileName = call.getString("fileName")?.replace(Regex("[\\\\/:*?\"<>|]"), "_") ?: return call.reject("Falta fileName", "INVALID")
        val mime = call.getString("mimeType") ?: "application/octet-stream"
        val pictures = call.getString("collection", "pictures") == "pictures"
        try {
            val uri = openSource(call).use { src -> writeToMediaStore(context, src, fileName, mime, pictures) }
            call.resolve(JSObject().put("uri", uri))
        } catch (e: Exception) {
            call.reject("No se pudo guardar: ${e.message}", "IO_ERROR", e)
        }
    }

    private fun openSource(call: PluginCall): InputStream {
        call.getString("path")?.let { path ->
            require(!path.contains("..")) { "Ruta no válida" }
            return File(context.filesDir, path).inputStream()
        }
        val data = call.getString("data") ?: throw IllegalArgumentException("Falta path o data")
        return Base64.decode(data.substringAfter(","), Base64.DEFAULT).inputStream()
    }

    private fun packToJs(p: StickerPack) = JSObject()
        .put("identifier", p.identifier)
        .put("name", p.name)
        .put("publisher", p.publisher)
        .put("animated", p.animated)
        .put("stickerCount", p.stickers.size)
        .put("imageDataVersion", p.imageDataVersion)

    companion object {
        const val STORAGE = "storage"
        private const val FOLDER = "StickerLab"

        fun writeToMediaStore(context: Context, src: InputStream, fileName: String, mime: String, pictures: Boolean): String {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver: ContentResolver = context.contentResolver
                val collection = if (pictures) MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                else MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, mime)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "${if (pictures) Environment.DIRECTORY_PICTURES else Environment.DIRECTORY_DOWNLOADS}/$FOLDER")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val uri: Uri = resolver.insert(collection, values) ?: throw IllegalStateException("MediaStore no creó el archivo")
                try {
                    resolver.openOutputStream(uri)!!.use { out -> src.copyTo(out) }
                    values.clear()
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                } catch (e: Exception) {
                    resolver.delete(uri, null, null)
                    throw e
                }
                return uri.toString()
            }
            @Suppress("DEPRECATION")
            val dir = File(Environment.getExternalStoragePublicDirectory(if (pictures) Environment.DIRECTORY_PICTURES else Environment.DIRECTORY_DOWNLOADS), FOLDER)
            dir.mkdirs()
            var file = File(dir, fileName)
            var n = 1
            while (file.exists()) file = File(dir, "${fileName.substringBeforeLast('.')} (${n++}).${fileName.substringAfterLast('.')}")
            FileOutputStream(file).use { out -> src.copyTo(out) }
            MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf(mime), null)
            return Uri.fromFile(file).toString()
        }
    }
}

/** Utilidades del proyecto oficial de WhatsApp (WhitelistCheck y AddStickerPackActivity). */
object WhatsAppHelper {
    const val CONSUMER = "com.whatsapp"
    const val BUSINESS = "com.whatsapp.w4b"
    const val ACTION_ENABLE_STICKER_PACK = "com.whatsapp.intent.action.ENABLE_STICKER_PACK"
    const val EXTRA_STICKER_PACK_ID = "sticker_pack_id"
    const val EXTRA_STICKER_PACK_AUTHORITY = "sticker_pack_authority"
    const val EXTRA_STICKER_PACK_NAME = "sticker_pack_name"
    const val EXTRA_VALIDATION_ERROR = "validation_error"

    private const val WHITELIST_PROVIDER = ".provider.sticker_whitelist_check"
    private const val QUERY_PATH = "is_whitelisted"
    private const val QUERY_RESULT_COLUMN = "result"

    fun isInstalled(context: Context, pkg: String): Boolean = try {
        val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.getApplicationInfo(pkg, PackageManager.ApplicationInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION") context.packageManager.getApplicationInfo(pkg, 0)
        }
        info.enabled
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    /** ¿WhatsApp (`pkg`) ya tiene añadido el pack `identifier` de esta app? */
    fun isPackWhitelisted(context: Context, pkg: String, identifier: String): Boolean {
        if (!WaLimits.isValidIdentifier(identifier) || !isInstalled(context, pkg)) return false
        val authority = pkg + WHITELIST_PROVIDER
        context.packageManager.resolveContentProvider(authority, PackageManager.GET_META_DATA) ?: return false
        val uri = Uri.Builder().scheme(ContentResolver.SCHEME_CONTENT).authority(authority)
            .appendPath(QUERY_PATH)
            .appendQueryParameter("authority", BuildConfig.CONTENT_PROVIDER_AUTHORITY)
            .appendQueryParameter("identifier", identifier)
            .build()
        return try {
            context.contentResolver.query(uri, null, null, null, null)?.use { c ->
                c.moveToFirst() && c.getInt(c.getColumnIndexOrThrow(QUERY_RESULT_COLUMN)) == 1
            } ?: false
        } catch (e: Exception) {
            false
        }
    }
}
