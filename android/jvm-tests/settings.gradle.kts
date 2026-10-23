// Proyecto mínimo para probar en la JVM (sin SDK de Android) la lógica del ContentProvider de stickers.
// Uso: npm run test:android  (o android/gradlew -p android/jvm-tests test)
rootProject.name = "stickerlab-jvm-tests"

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}
