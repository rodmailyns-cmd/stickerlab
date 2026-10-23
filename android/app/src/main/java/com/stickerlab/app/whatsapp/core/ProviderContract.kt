package com.stickerlab.app.whatsapp.core

/**
 * Columnas y filas que WhatsApp espera del ContentProvider de stickers.
 * Nombres tomados del proyecto oficial (WhatsApp/stickers, StickerContentProvider.java).
 */
object ProviderContract {
    const val METADATA = "metadata"
    const val STICKERS = "stickers"
    const val STICKERS_ASSET = "stickers_asset"

    const val STICKER_PACK_IDENTIFIER_IN_QUERY = "sticker_pack_identifier"
    const val STICKER_PACK_NAME_IN_QUERY = "sticker_pack_name"
    const val STICKER_PACK_PUBLISHER_IN_QUERY = "sticker_pack_publisher"
    const val STICKER_PACK_ICON_IN_QUERY = "sticker_pack_icon"
    const val ANDROID_APP_DOWNLOAD_LINK_IN_QUERY = "android_play_store_link"
    const val IOS_APP_DOWNLOAD_LINK_IN_QUERY = "ios_app_download_link"
    const val PUBLISHER_EMAIL = "sticker_pack_publisher_email"
    const val PUBLISHER_WEBSITE = "sticker_pack_publisher_website"
    const val PRIVACY_POLICY_WEBSITE = "sticker_pack_privacy_policy_website"
    const val LICENSE_AGREEMENT_WEBSITE = "sticker_pack_license_agreement_website"
    const val IMAGE_DATA_VERSION = "image_data_version"
    const val AVOID_CACHE = "whatsapp_will_not_cache_stickers"
    const val ANIMATED_STICKER_PACK = "animated_sticker_pack"

    const val STICKER_FILE_NAME_IN_QUERY = "sticker_file_name"
    const val STICKER_FILE_EMOJI_IN_QUERY = "sticker_emoji"
    const val STICKER_FILE_ACCESSIBILITY_TEXT_IN_QUERY = "sticker_accessibility_text"

    val METADATA_COLUMNS = arrayOf(
        STICKER_PACK_IDENTIFIER_IN_QUERY,
        STICKER_PACK_NAME_IN_QUERY,
        STICKER_PACK_PUBLISHER_IN_QUERY,
        STICKER_PACK_ICON_IN_QUERY,
        ANDROID_APP_DOWNLOAD_LINK_IN_QUERY,
        IOS_APP_DOWNLOAD_LINK_IN_QUERY,
        PUBLISHER_EMAIL,
        PUBLISHER_WEBSITE,
        PRIVACY_POLICY_WEBSITE,
        LICENSE_AGREEMENT_WEBSITE,
        IMAGE_DATA_VERSION,
        AVOID_CACHE,
        ANIMATED_STICKER_PACK,
    )

    val STICKER_COLUMNS = arrayOf(STICKER_FILE_NAME_IN_QUERY, STICKER_FILE_EMOJI_IN_QUERY, STICKER_FILE_ACCESSIBILITY_TEXT_IN_QUERY)

    fun metadataRow(pack: StickerPack, playStoreLink: String = ""): Array<Any?> = arrayOf(
        pack.identifier,
        pack.name,
        pack.publisher,
        pack.trayImageFile,
        playStoreLink,
        "",
        pack.publisherEmail,
        pack.publisherWebsite,
        pack.privacyPolicyWebsite,
        pack.licenseAgreementWebsite,
        pack.imageDataVersion.toString(),
        if (pack.avoidCache) 1 else 0,
        if (pack.animated) 1 else 0,
    )

    fun stickerRows(pack: StickerPack): List<Array<Any?>> =
        pack.stickers.map { arrayOf(it.imageFile, it.emojis.joinToString(","), it.accessibilityText) }

    /** Tipo de ruta de una URI del provider: (código, identificador, archivo). */
    sealed interface Route {
        data object AllMetadata : Route
        data class PackMetadata(val identifier: String) : Route
        data class Stickers(val identifier: String) : Route
        data class Asset(val identifier: String, val fileName: String) : Route
    }

    /** Interpreta los segmentos de ruta de la URI (sin depender de UriMatcher). */
    fun route(segments: List<String>): Route? = when {
        segments == listOf(METADATA) -> Route.AllMetadata
        segments.size == 2 && segments[0] == METADATA -> Route.PackMetadata(segments[1])
        segments.size == 2 && segments[0] == STICKERS -> Route.Stickers(segments[1])
        segments.size == 3 && segments[0] == STICKERS_ASSET -> Route.Asset(segments[1], segments[2])
        else -> null
    }

    fun mimeType(route: Route, authority: String): String = when (route) {
        Route.AllMetadata -> "vnd.android.cursor.dir/vnd.$authority.$METADATA"
        is Route.PackMetadata -> "vnd.android.cursor.item/vnd.$authority.$METADATA"
        is Route.Stickers -> "vnd.android.cursor.dir/vnd.$authority.$STICKERS"
        is Route.Asset -> if (route.fileName.endsWith(".png")) "image/png" else "image/webp"
    }
}
