package com.stickerlab.app.whatsapp.core

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Contrato web → Kotlin: valida con el almacén real los packs que la web envió al plugin
 * en la prueba E2E del modo APK (scripts/e2e-native.mjs).
 * Se ejecuta con: gradle test -Dstickerlab.nativeDir=../../e2e-output/native
 */
class WebBridgeContractTest {
    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun packsEnviadosPorLaWebSonValidos() {
        val dir = System.getProperty("stickerlab.nativeDir").orEmpty()
        val packs = File(dir, "packs").listFiles()?.filter { File(it, "input.json").isFile }.orEmpty()
        assumeTrue("Sin packs de la E2E nativa", packs.isNotEmpty())
        val store = StickerPackStore(tmp.newFolder("wa-packs"))
        for (staging in packs) {
            val input = PackInput.fromJson(JSONObject(File(staging, "input.json").readText()))
            assertEquals(emptyList<String>(), store.validate(input, staging))
            val pack = store.savePack(input, staging)
            val row = ProviderContract.metadataRow(pack)
            assertEquals(input.identifier, row[0])
            for (s in pack.stickers) {
                val served = store.resolveAsset(pack.identifier, s.imageFile)
                assertNotNull(served)
                assertArrayEquals(File(staging, s.imageFile).readBytes(), served!!.readBytes())
                println("  ${pack.name}/${s.imageFile}: ${served.length() / 1024} KB, emojis ${s.emojis}")
            }
            println("✓ Pack \"${pack.name}\" (${pack.stickers.size} stickers, animado=${pack.animated}) aceptado por StickerPackStore")
        }
    }
}
