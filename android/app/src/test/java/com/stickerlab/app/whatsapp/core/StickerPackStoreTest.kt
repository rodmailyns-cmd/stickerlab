package com.stickerlab.app.whatsapp.core

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Prueba el almacén de packs y lo que sirve el ContentProvider usando packs reales
 * exportados por la web (src/test/resources/packs, sacados del ZIP "whatsapp-assets").
 */
class StickerPackStoreTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private lateinit var store: StickerPackStore

    @Before
    fun setUp() {
        store = StickerPackStore(tmp.newFolder("wa-packs"))
    }

    /** Copia un pack de ejemplo a una carpeta de "staging", como hace la web con Filesystem. */
    private fun stage(name: String): Pair<PackInput, File> {
        val src = File(javaClass.getResource("/packs/$name/contents.json")!!.toURI()).parentFile
        val staging = tmp.newFolder("staging-$name-${System.nanoTime()}")
        src.listFiles()!!.filter { it.name != "contents.json" }.forEach { it.copyTo(File(staging, it.name)) }
        val json = JSONObject(File(src, "contents.json").readText()).getJSONArray("sticker_packs").getJSONObject(0)
        return PackInput.fromJson(json) to staging
    }

    @Test
    fun guardaPackEstaticoYLoSirve() {
        val (input, staging) = stage("static")
        val pack = store.savePack(input, staging)
        assertEquals(1, pack.imageDataVersion)
        assertFalse(pack.animated)

        // metadata
        val listed = store.listPacks()
        assertEquals(1, listed.size)
        val row = ProviderContract.metadataRow(listed[0])
        assertEquals(ProviderContract.METADATA_COLUMNS.size, row.size)
        assertEquals(input.identifier, row[0])
        assertEquals("E2E estatico", row[1])
        assertEquals("StickerLab E2E", row[2])
        assertEquals("tray.png", row[3])
        assertEquals("1", row[10])
        assertEquals(0, row[12])

        // stickers
        val rows = ProviderContract.stickerRows(listed[0])
        assertEquals(3, rows.size)
        assertEquals("01.webp", rows[0][0])
        assertEquals("😀", rows[0][1])

        // archivos: lo servido es idéntico a lo exportado por la web
        for (f in listOf("tray.png", "01.webp", "02.webp", "03.webp")) {
            val served = store.resolveAsset(input.identifier, f)
            assertNotNull("debe servir $f", served)
            assertArrayEquals(File(staging, f).readBytes(), served!!.readBytes())
        }
    }

    @Test
    fun packAnimadoCumpleLimites() {
        val (input, staging) = stage("animated")
        val pack = store.savePack(input, staging)
        assertTrue(pack.animated)
        assertEquals(1, ProviderContract.metadataRow(pack)[12])
        for (s in pack.stickers) {
            val f = store.resolveAsset(pack.identifier, s.imageFile)!!
            val info = ImageInfo.read(f)!!
            assertEquals(ImageInfo.Format.WEBP, info.format)
            assertEquals(512, info.width)
            assertEquals(512, info.height)
            assertTrue(info.animated)
            assertTrue("duración ${info.durationMs} ms", info.durationMs in 1..10_000)
            assertTrue("peso ${f.length()}", f.length() <= WaLimits.ANIMATED_MAX_BYTES)
        }
        val tray = ImageInfo.read(store.resolveAsset(pack.identifier, "tray.png")!!)!!
        assertEquals(ImageInfo.Format.PNG, tray.format)
        assertEquals(96, tray.width)
    }

    @Test
    fun estaticosPesanMenosDe100KB() {
        val (input, staging) = stage("static")
        val pack = store.savePack(input, staging)
        for (s in pack.stickers) {
            val f = store.resolveAsset(pack.identifier, s.imageFile)!!
            val info = ImageInfo.read(f)!!
            assertFalse(info.animated)
            assertEquals(512, info.width)
            assertTrue(f.length() <= WaLimits.STATIC_MAX_BYTES)
        }
    }

    @Test
    fun noSirveArchivosFueraDelPack() {
        val (input, staging) = stage("static")
        store.savePack(input, staging)
        assertNull(store.resolveAsset(input.identifier, "pack.json"))
        assertNull(store.resolveAsset(input.identifier, "../pack.json"))
        assertNull(store.resolveAsset(input.identifier, "99.webp"))
        assertNull(store.resolveAsset("../wa-packs", "01.webp"))
        assertNull(store.resolveAsset("no-existe", "01.webp"))
    }

    @Test
    fun versionSoloSubeSiCambiaElContenido() {
        val (input, staging) = stage("static")
        assertEquals(1, store.savePack(input, staging).imageDataVersion)
        val (same, staging2) = stage("static")
        assertEquals(1, store.savePack(same, staging2).imageDataVersion)
        val (_, staging3) = stage("static")
        val renamed = same.copy(name = "Otro nombre")
        assertEquals(2, store.savePack(renamed, staging3).imageDataVersion)
        assertEquals("Otro nombre", store.getPack(input.identifier)!!.name)
    }

    @Test
    fun rechazaPacksInvalidosSinTocarElAnterior() {
        val (input, staging) = stage("static")
        store.savePack(input, staging)

        val (bad, staging2) = stage("static")
        val cases = listOf(
            bad.copy(stickers = bad.stickers.take(2)) to "entre 3 y 30",
            bad.copy(animated = true) to "mezclar",
            bad.copy(stickers = bad.stickers.map { it.copy(emojis = emptyList()) }) to "emojis",
            bad.copy(trayImageFile = "01.webp") to "PNG",
            bad.copy(identifier = "../fuera") to "Identificador",
            bad.copy(stickers = bad.stickers.map { it.copy(imageFile = "../" + it.imageFile) }) to "falta el archivo",
        )
        for ((candidate, expected) in cases) {
            try {
                store.savePack(candidate, staging2)
                fail("debía rechazar: $expected")
            } catch (e: PackValidationException) {
                assertTrue("'${e.message}' debería mencionar '$expected'", e.errors.any { it.contains(expected, ignoreCase = true) })
            }
        }
        // El pack bueno sigue intacto
        assertEquals(1, store.listPacks().size)
        assertEquals("E2E estatico", store.getPack(input.identifier)!!.name)
    }

    @Test
    fun rechazaArchivosDemasiadoGrandes() {
        val (input, staging) = stage("static")
        File(staging, "01.webp").appendBytes(ByteArray(120 * 1024))
        try {
            store.savePack(input, staging)
            fail("debía rechazar un sticker de más de 100 KB")
        } catch (e: PackValidationException) {
            assertTrue(e.errors.any { it.contains("máximo 100 KB") })
        }
    }

    @Test
    fun borraPacks() {
        val (input, staging) = stage("static")
        store.savePack(input, staging)
        assertTrue(store.deletePack(input.identifier))
        assertTrue(store.listPacks().isEmpty())
        assertFalse(store.deletePack("../wa-packs"))
    }

    @Test
    fun rutasDelProvider() {
        assertEquals(ProviderContract.Route.AllMetadata, ProviderContract.route(listOf("metadata")))
        assertEquals(ProviderContract.Route.PackMetadata("abc"), ProviderContract.route(listOf("metadata", "abc")))
        assertEquals(ProviderContract.Route.Stickers("abc"), ProviderContract.route(listOf("stickers", "abc")))
        assertEquals(ProviderContract.Route.Asset("abc", "01.webp"), ProviderContract.route(listOf("stickers_asset", "abc", "01.webp")))
        assertNull(ProviderContract.route(listOf("otra")))
        val auth = "com.stickerlab.app.stickercontentprovider"
        assertEquals("image/webp", ProviderContract.mimeType(ProviderContract.Route.Asset("a", "01.webp"), auth))
        assertEquals("image/png", ProviderContract.mimeType(ProviderContract.Route.Asset("a", "tray.png"), auth))
        assertEquals("vnd.android.cursor.dir/vnd.$auth.metadata", ProviderContract.mimeType(ProviderContract.Route.AllMetadata, auth))
    }
}
