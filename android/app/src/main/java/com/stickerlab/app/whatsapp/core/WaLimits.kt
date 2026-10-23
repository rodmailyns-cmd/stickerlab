package com.stickerlab.app.whatsapp.core

import java.io.File
import java.io.RandomAccessFile

/** Requisitos de WhatsApp para packs de terceros (los mismos que valida la web, KB = 1024). */
object WaLimits {
    const val STICKER_SIZE = 512
    const val TRAY_SIZE = 96
    const val TRAY_MIN_SIZE = 24
    const val TRAY_MAX_SIZE = 512
    const val STATIC_MAX_BYTES = 100 * 1024L
    const val ANIMATED_MAX_BYTES = 500 * 1024L
    const val TRAY_MAX_BYTES = 50 * 1024L
    const val ANIMATED_MAX_DURATION_MS = 10_000
    const val MIN_STICKERS = 3
    const val MAX_STICKERS = 30
    const val MAX_EMOJIS = 3
    const val MAX_NAME = 128

    /** Igual que el validador oficial de WhatsApp: letras, números, _ - . , ' y espacios. */
    private val IDENTIFIER = Regex("^[a-zA-Z0-9_.,' \\-]{1,128}$")
    private val FILE_NAME = Regex("^[a-zA-Z0-9_.\\-]{1,64}\\.(webp|png)$")

    fun isValidIdentifier(id: String) = IDENTIFIER.matches(id) && id.isNotBlank() && !id.startsWith(".")
    fun isSafeFileName(name: String) = FILE_NAME.matches(name) && !name.contains("..")
}

/** Lectura mínima de cabeceras PNG y WebP (tamaño, animación y duración). */
data class ImageInfo(val format: Format, val width: Int, val height: Int, val animated: Boolean, val durationMs: Int) {
    enum class Format { PNG, WEBP }

    companion object {
        fun read(file: File): ImageInfo? = try {
            RandomAccessFile(file, "r").use { read(it) }
        } catch (e: Exception) {
            null
        }

        private fun read(f: RandomAccessFile): ImageInfo? {
            val head = ByteArray(30)
            if (f.read(head) < 30) return null
            if (head[0] == 0x89.toByte() && String(head, 1, 3, Charsets.US_ASCII) == "PNG") {
                return ImageInfo(Format.PNG, be32(head, 16), be32(head, 20), false, 0)
            }
            if (String(head, 0, 4, Charsets.US_ASCII) != "RIFF" || String(head, 8, 4, Charsets.US_ASCII) != "WEBP") return null
            var width = 0
            var height = 0
            var animated = false
            var duration = 0
            var pos = 12L
            val hdr = ByteArray(8)
            while (pos + 8 <= f.length()) {
                f.seek(pos)
                f.readFully(hdr)
                val fourcc = String(hdr, 0, 4, Charsets.US_ASCII)
                val size = le32(hdr, 4).toLong() and 0xffffffffL
                val body = pos + 8
                when (fourcc) {
                    "VP8X" -> {
                        val b = ByteArray(10)
                        f.seek(body); f.readFully(b)
                        animated = (b[0].toInt() and 0x02) != 0
                        width = 1 + le24(b, 4)
                        height = 1 + le24(b, 7)
                    }
                    "ANMF" -> {
                        val b = ByteArray(16)
                        f.seek(body); f.readFully(b)
                        duration += le24(b, 12)
                    }
                    "VP8 " -> if (width == 0) {
                        val b = ByteArray(10)
                        f.seek(body); f.readFully(b)
                        width = le16(b, 6) and 0x3fff
                        height = le16(b, 8) and 0x3fff
                    }
                    "VP8L" -> if (width == 0) {
                        val b = ByteArray(5)
                        f.seek(body); f.readFully(b)
                        val bits = le32(b, 1)
                        width = (bits and 0x3fff) + 1
                        height = ((bits shr 14) and 0x3fff) + 1
                    }
                }
                pos = body + size + (size and 1)
            }
            return ImageInfo(Format.WEBP, width, height, animated, duration)
        }

        private fun be32(b: ByteArray, o: Int) =
            ((b[o].toInt() and 0xff) shl 24) or ((b[o + 1].toInt() and 0xff) shl 16) or ((b[o + 2].toInt() and 0xff) shl 8) or (b[o + 3].toInt() and 0xff)
        private fun le16(b: ByteArray, o: Int) = (b[o].toInt() and 0xff) or ((b[o + 1].toInt() and 0xff) shl 8)
        private fun le24(b: ByteArray, o: Int) = le16(b, o) or ((b[o + 2].toInt() and 0xff) shl 16)
        private fun le32(b: ByteArray, o: Int) = le24(b, o) or ((b[o + 3].toInt() and 0xff) shl 24)
    }
}
