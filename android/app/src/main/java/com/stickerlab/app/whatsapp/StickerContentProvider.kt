package com.stickerlab.app.whatsapp

import android.content.ContentProvider
import android.content.ContentValues
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Log
import com.stickerlab.app.BuildConfig
import com.stickerlab.app.whatsapp.core.ProviderContract
import com.stickerlab.app.whatsapp.core.ProviderContract.Route
import com.stickerlab.app.whatsapp.core.StickerPackStore
import java.io.File

/**
 * ContentProvider oficial de stickers de WhatsApp.
 *
 * Sirve de forma dinámica los packs que el usuario crea en la app (guardados en `filesDir/wa-packs`):
 * - `content://<authority>/metadata`                      todos los packs
 * - `content://<authority>/metadata/<id>`                 un pack
 * - `content://<authority>/stickers/<id>`                 stickers de un pack
 * - `content://<authority>/stickers_asset/<id>/<archivo>` el .webp o el icono .png
 *
 * Solo WhatsApp puede leerlo (permiso `com.whatsapp.sticker.READ` en el manifiesto).
 */
class StickerContentProvider : ContentProvider() {

    private val store: StickerPackStore by lazy { packStore(context!!.filesDir) }

    override fun onCreate(): Boolean {
        val authority = BuildConfig.CONTENT_PROVIDER_AUTHORITY
        check(authority.startsWith(context!!.packageName)) {
            "La authority ($authority) debe empezar por el nombre del paquete (${context!!.packageName})"
        }
        return true
    }

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? {
        val route = route(uri)
        val cursor = when (route) {
            Route.AllMetadata -> MatrixCursor(ProviderContract.METADATA_COLUMNS).apply {
                store.listPacks().forEach { addRow(ProviderContract.metadataRow(it)) }
            }
            is Route.PackMetadata -> MatrixCursor(ProviderContract.METADATA_COLUMNS).apply {
                store.getPack(route.identifier)?.let { addRow(ProviderContract.metadataRow(it)) }
            }
            is Route.Stickers -> MatrixCursor(ProviderContract.STICKER_COLUMNS).apply {
                store.getPack(route.identifier)?.let { pack -> ProviderContract.stickerRows(pack).forEach { addRow(it) } }
            }
            is Route.Asset -> throw IllegalArgumentException("Usa openAssetFile para $uri")
        }
        cursor.setNotificationUri(context!!.contentResolver, uri)
        return cursor
    }

    override fun openAssetFile(uri: Uri, mode: String): AssetFileDescriptor? {
        val route = route(uri) as? Route.Asset ?: throw IllegalArgumentException("URI no válida: $uri")
        val file: File = store.resolveAsset(route.identifier, route.fileName)
            ?: run {
                Log.e(TAG, "Archivo no encontrado: ${route.identifier}/${route.fileName}")
                return null
            }
        val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
        return AssetFileDescriptor(pfd, 0, file.length())
    }

    override fun getType(uri: Uri): String = ProviderContract.mimeType(route(uri), BuildConfig.CONTENT_PROVIDER_AUTHORITY)

    private fun route(uri: Uri): Route {
        require(uri.authority == BuildConfig.CONTENT_PROVIDER_AUTHORITY) { "Authority desconocida: ${uri.authority}" }
        return ProviderContract.route(uri.pathSegments) ?: throw IllegalArgumentException("URI desconocida: $uri")
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri = throw UnsupportedOperationException("No permitido")
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = throw UnsupportedOperationException("No permitido")
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int =
        throw UnsupportedOperationException("No permitido")

    companion object {
        private const val TAG = "StickerContentProvider"
        const val PACKS_DIR = "wa-packs"

        fun packStore(filesDir: File) = StickerPackStore(File(filesDir, PACKS_DIR))
    }
}
