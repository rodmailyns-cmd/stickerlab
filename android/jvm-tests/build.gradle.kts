plugins {
    kotlin("jvm") version "2.2.21"
}

repositories {
    mavenCentral()
}

kotlin {
    jvmToolchain(21)
}

sourceSets {
    main {
        kotlin.srcDir("../app/src/main/java/com/stickerlab/app/whatsapp/core")
    }
    test {
        kotlin.srcDir("../app/src/test/java")
        resources.srcDir("../app/src/test/resources")
    }
}

dependencies {
    implementation("org.json:json:20250517")
    testImplementation("junit:junit:4.13.2")
}

tasks.test {
    // Carpeta con los packs que escribió la E2E del modo APK (opcional)
    System.getProperty("stickerlab.nativeDir")?.let { systemProperty("stickerlab.nativeDir", file(it).absolutePath) }
    testLogging {
        showStandardStreams = true
        events("passed", "failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}

// Comprobación de compilación del código Android (plugin, ContentProvider, MainActivity) sin SDK:
// usa el framework de Android publicado en Maven Central por Robolectric y stubs de Capacitor.
val androidCheck by sourceSets.creating {
    java.srcDir("stubs")
    kotlin.srcDir("../app/src/main/java")
}
dependencies {
    "androidCheckCompileOnly"("org.robolectric:android-all:15-robolectric-13954326")
}
tasks.register("compileAndroidCode") {
    group = "verification"
    description = "Compila el código Kotlin de la app contra android-all (API 35)"
    dependsOn("compileAndroidCheckKotlin", "compileAndroidCheckJava")
}
