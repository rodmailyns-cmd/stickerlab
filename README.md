# StickerLab 🐾

Crea stickers estáticos y animados y añádelos a WhatsApp. Es una app de Android (APK hecho con Capacitor) que también funciona como web/PWA. No hay servidor: todo se procesa en el teléfono y funciona sin internet, incluida la IA para quitar fondos.

## Stack

- React + Vite + TypeScript + Tailwind CSS + Framer Motion (interfaz)
- **Capacitor 8** para empaquetar la app como APK de Android (plugins de cámara, archivos, compartir, portapapeles, háptica, teclado, splash y botón atrás)
- Plugin nativo propio de Capacitor en Kotlin para la integración con WhatsApp (ver "Integración nativa con WhatsApp")
- Editor de lienzo: Konva
- Conversión y animación: libwebp (WASM, `@jsquash/webp`) en web workers; el WebP animado se monta a mano (chunks `VP8X`, `ANIM`, `ANMF`), sin ffmpeg.wasm
- Quitar fondo: `@imgly/background-removal` con el modelo incluido en la app (corre en el dispositivo, sin internet)
- Fuentes: 35 Google Fonts incluidas en la app (`@fontsource`), también sin internet
- Estado: Zustand. Persistencia local: IndexedDB (`idb`) y el almacenamiento interno de Android para los packs
- Sin backend

## Arranque rápido (web)

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm install` y `npm run dev` copian automáticamente las fuentes y el modelo de IA a `public/` (`npm run assets`).

## Generar el APK de Android

### 1. Qué instalar (una sola vez)

| Herramienta | Versión | Cómo |
|---|---|---|
| Node.js | 20 o superior | https://nodejs.org |
| JDK | 21 | Viene dentro de Android Studio (o instala Temurin 21) |
| Android Studio | Una versión de 2025 o posterior | https://developer.android.com/studio |
| Android SDK | Platform 36, Build-Tools 35.0.0, Platform-Tools | Android Studio → *Settings → Languages & Frameworks → Android SDK* |

Sin Android Studio, solo con la línea de comandos:

```bash
# Descarga "Command line tools only" de https://developer.android.com/studio#command-tools
# y descomprímelas en ~/Android/Sdk/cmdline-tools/latest
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
sdkmanager "platforms;android-36" "build-tools;35.0.0" "platform-tools"
yes | sdkmanager --licenses
```

En Windows, `ANDROID_HOME` suele ser `%LOCALAPPDATA%\Android\Sdk`. Si Gradle no encuentra el SDK, crea `android/local.properties` con `sdk.dir=/ruta/a/Android/Sdk`.

### 2. Compilar

```bash
npm install
npm run android:debug
# equivale a: npm run build && npx cap sync android && cd android && ./gradlew assembleDebug
```

El APK queda en **`android/app/build/outputs/apk/debug/app-debug.apk`** (unos 70 MB, porque incluye el modelo de IA para quitar fondos).

También puedes abrir el proyecto en Android Studio con `npm run android:open` y pulsar ▶ con el teléfono conectado.

### 3. Instalarlo en el teléfono

- **Con cable:** activa *Opciones de desarrollador → Depuración USB*, conecta el teléfono y ejecuta `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
- **Sin cable:** copia el `.apk` al teléfono (Drive, Telegram, correo…), ábrelo y permite *Instalar apps de origen desconocido* cuando lo pida.

### 4. APK de release firmado

```bash
# Crea la clave una vez (guárdala bien: sin ella no podrás actualizar la app)
keytool -genkey -v -keystore android/stickerlab-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias stickerlab
```

Crea `android/keystore.properties` (está en `.gitignore`):

```properties
storeFile=stickerlab-release.jks
storePassword=TU_CONTRASEÑA
keyAlias=stickerlab
keyPassword=TU_CONTRASEÑA
```

```bash
npm run android:release
# APK: android/app/build/outputs/apk/release/app-release.apk
# AAB para Google Play: android/app/build/outputs/bundle/release/app-release.aab
```

### Compilar en GitHub (sin instalar nada)

El flujo `.github/workflows/android.yml` compila `app-debug.apk` en cada push a `main`. Sube el proyecto a un repositorio de GitHub y descarga el APK desde la pestaña *Actions → APK de Android → Artifacts*.

## Integración nativa con WhatsApp (APK)

- **ContentProvider oficial** (`android/app/src/main/java/com/stickerlab/app/whatsapp/StickerContentProvider.kt`), declarado en el `AndroidManifest.xml` con el permiso `com.whatsapp.sticker.READ`. Sirve `metadata`, `stickers` y `stickers_asset` (los WebP y el icono) **de forma dinámica** desde el almacenamiento interno (`files/wa-packs/<id>/`) según los packs que crea el usuario.
- **Botón "Añadir a WhatsApp"** en cada pack. Copia el pack a la app y lanza el intent oficial `com.whatsapp.intent.action.ENABLE_STICKER_PACK`. Funciona con WhatsApp y WhatsApp Business; si tienes los dos, pregunta a cuál.
- **Detecta si WhatsApp está instalado** y, si no, avisa con un botón a Play Store.
- **Estado "Añadido ✓"**: pregunta a WhatsApp (`sticker_whitelist_check`) si el pack ya está añadido; se vuelve a comprobar al volver a la app. Si cambias un pack ya añadido, aparece "Actualizar en WhatsApp" y se sube `image_data_version` para que WhatsApp lo recargue.
- **Errores y reintentos**: la copia de archivos se reintenta con espera creciente; los errores de validación de WhatsApp se muestran tal cual, con botón "Reintentar". El plugin vuelve a validar el pack (tamaños, pesos, 512×512, 3–30 stickers, emojis, no mezclar animados) antes de servirlo, y la escritura es atómica.
- **Permisos**: no pide ninguno para WhatsApp. Cámara solo al hacer una foto. Almacenamiento solo en Android 9 o anterior, para guardar en la galería.
- **Más salidas**: guardar `.webp` en la galería (*Imágenes/StickerLab*), compartir un sticker suelto con el menú de Android, guardar `.wastickers` y ZIP en *Descargas/StickerLab*, e **importar** un `.wastickers` o ZIP como copia de seguridad (*Packs → Importar pack*).
- **Configuración de Android**: `applicationId` `com.stickerlab.app`, nombre "StickerLab", icono adaptativo, splash pastel (claro y oscuro) y firma de release por `keystore.properties`.

| Requisito de WhatsApp | Estático | Animado |
|---|---|---|
| Formato | WebP 512×512 transparente | WebP animado 512×512 en bucle |
| Peso máximo | 100 KB | 500 KB, ≤ 10 s |
| Icono de bandeja | PNG 96×96, ≤ 50 KB | igual |
| Pack | 3–30 stickers, 1–3 emojis cada uno | sin mezclar con estáticos |

Si un sticker se pasa del límite, el optimizador baja calidad, FPS, detalle y colores hasta que cabe.

## Experiencia móvil nativa (APK)

- Diseño mobile-first: barra inferior, **hoja deslizable** (arrastra el asa para ampliarla o cerrarla) y gestos de **pellizcar para escalar y girar con dos dedos** la capa seleccionada. Sin capa seleccionada, pellizcar hace zoom en el lienzo.
- Respeta las **áreas seguras** (muesca y barra de navegación), orientación vertical y teclado (la barra inferior se oculta al escribir).
- **Vibración háptica** sutil al añadir/borrar capas, guardar, añadir a un pack y añadir a WhatsApp.
- **Botón atrás de Android**: cierra diálogos, menús y la hoja inferior; vuelve de un pack a la lista, luego al editor, y después minimiza la app.
- Rendimiento en gama media: codificación en web workers, resolución de trabajo limitada (imágenes a 1024 px, animaciones a 512 px y 90 fotogramas en el móvil) y liberación de memoria al cambiar de proyecto.

## Qué más puedes hacer

- **Editor 512×512:** importar (arrastrar, pegar, cámara, imágenes, GIF y vídeo con recorte), quitar fondo y retocar, recortes con forma, contorno y sombra, texto con estilos de meme y texto curvo, emojis y decoraciones, dibujo, filtros, capas, deshacer ilimitado, plantillas y reacciones rápidas.
- **Animación:** keyframes por capa y 10 animaciones (rebote, latido, giro, temblor, flotar, aparecer, brillo, arcoíris, zoom, péndulo), GIF/vídeo a sticker, 8–30 FPS y peso en vivo.
- **Biblioteca y packs:** búsqueda, etiquetas, favoritos, packs con orden por arrastre, proyectos `.stickerlab` y copia de seguridad completa.

Atajos de teclado (con teclado físico): Ctrl+Z / Ctrl+Shift+Z deshacer y rehacer, Ctrl+S guardar, Ctrl+D duplicar, Supr borrar, flechas mover, `[` `]` orden, Ctrl+G agrupar, Espacio reproducir, V/B/E/T herramientas, `?` ayuda.

## Cómo añadir un pack a WhatsApp

- **Con el APK (Android):** abre el pack y pulsa **Añadir a WhatsApp**. Listo.
- **Desde la web en Android:** exporta el `.wastickers` y ábrelo con una app importadora (p. ej. "Sticker Maker"), o instala el APK.
- **iPhone:** descarga los `.webp` y usa una app de stickers de iOS para crear el pack.
- **WhatsApp Web / Escritorio:** icono de stickers → *Crear* → sube el `.webp`.

## Estructura

```
src/
  lib/native/             Puente con Android: WhatsApp, archivos, háptica, botón atrás, cámara
  lib/render/             Renderizador Konva compartido por editor y exportación
  lib/export/             Límites de WhatsApp, optimizador, validador y empaquetado
  lib/webp/               RIFF/WebP animado y pool de workers de codificación
  lib/storage/            IndexedDB, proyectos, copias de seguridad e importación de packs
  features/               Pantallas: editor, biblioteca, packs (con WhatsAppCard), onboarding, ayuda
android/
  app/src/main/java/com/stickerlab/app/
    MainActivity.kt
    whatsapp/WhatsAppStickersPlugin.kt   Plugin de Capacitor (intent, estado, guardar en galería)
    whatsapp/StickerContentProvider.kt   ContentProvider oficial de WhatsApp
    whatsapp/core/                       Lógica pura (almacén de packs, validación, columnas)
  app/src/test/                          Pruebas JVM con packs reales exportados por la web
  jvm-tests/                             Ejecuta esas pruebas sin SDK de Android
assets/                   Fuentes del icono y del splash (npm run icons los regenera)
scripts/                  E2E con Chromium, iconos y copia de fuentes/modelo
tests/                    Pruebas unitarias de la exportación (Vitest)
```

## Pruebas

```bash
npm test               # exportación: RIFF, optimizador, validador, empaquetado
npm run test:android   # ContentProvider y almacén de packs en la JVM (no necesita SDK)
```

De punta a punta (con `npm run build && npm run preview` en otra terminal y `CHROMIUM_PATH` apuntando a Chromium):

```bash
npm run e2e            # crea stickers y packs desde la interfaz → e2e-output/
npm run e2e:features   # GIF, vídeo, dibujo, texto curvo, proyectos, importar packs, modo oscuro
npm run e2e:native     # modo APK con un puente nativo simulado: Añadir a WhatsApp, atrás, pellizcar, galería
npm run test:output    # valida los ZIP exportados contra los límites de WhatsApp
android/gradlew -p android/jvm-tests test -Dstickerlab.nativeDir=../../e2e-output/native   # el pack que envió la web, validado por el Kotlin real
```
