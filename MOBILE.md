# Mobile setup — iOS and Android via Capacitor

The same React app you run on the web wraps into a native iOS and Android app
using [Capacitor](https://capacitorjs.com). No code changes — just shell projects
that load the bundled web assets.

## Prerequisites

| Target  | You need |
|---------|----------|
| iOS     | macOS + Xcode 15+ + Apple Developer account (for device testing) |
| Android | Android Studio Iguana+ + a JDK 17+ |

You don't need a Mac to build Android. iOS requires macOS.

## First-time setup

```bash
# 1. Install Capacitor CLI and platform deps
npm install

# 2. Build the web bundle once so dist/ exists
npm run build

# 3. Add the native platforms (creates ios/ and android/ folders)
npx cap add ios
npx cap add android

# 4. Sync — copies dist/ + plugin native code into the platforms
npx cap sync
```

## Running on iOS

```bash
npm run cap:open:ios
# In Xcode: select your team in Signing & Capabilities, plug in a device,
# choose it from the device dropdown, hit Run.
```

For iOS, the following permissions must be added to `ios/App/App/Info.plist`
(Capacitor adds skeleton entries when you add the plugins, but the descriptions
need editing):

```xml
<key>NSCameraUsageDescription</key>
<string>Atlas uses your camera to capture photos for your travel memories.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Atlas uses your photo library to add photos to your travel memories.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Atlas saves photos you take to your photo library.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Atlas uses your location to suggest the place you're currently visiting.</string>
```

## Running on Android

```bash
npm run cap:open:android
# In Android Studio: Run → Run 'app'. Use an emulator or plug in a device with
# USB debugging enabled.
```

For Android, permissions are auto-injected from plugins. The `android/app/src/main/AndroidManifest.xml`
should already contain `CAMERA`, `READ_EXTERNAL_STORAGE`, and `READ_MEDIA_IMAGES`.

## Live-reload from dev server (optional)

Edit `capacitor.config.ts` and uncomment the `server.url`, pointing it at your
machine's LAN IP (not `localhost`):

```ts
server: {
  url: 'http://192.168.1.42:5173',
  cleartext: true,
},
```

Then `npm run dev` and `npm run cap:run:ios` (or android). The app loads from
your Vite server with hot reload working in the WebView.

Remember to comment this out before building for release — otherwise the production
app will try to load from a LAN IP that doesn't exist for end users.

## Production builds

### iOS
- In Xcode: Product → Archive → Distribute App → App Store Connect (or Ad-Hoc for TestFlight)

### Android
- `cd android && ./gradlew bundleRelease` — produces an AAB you can upload to Play Console
- Or in Android Studio: Build → Generate Signed Bundle/APK

## What works natively (vs web)

Same React code, different adapter behind the scenes:

| Feature | Web | Native |
|---------|-----|--------|
| Photo picker | `<input type=file>` | Native photo library (multi-select) |
| Camera | `<input capture=environment>` | Native camera with full quality |
| Share | Web Share API (where available) | Native share sheet |
| Haptic feedback | no-op | Light impact on upload success |
| External browser | new tab | In-app SafariViewController / Custom Tabs |

All of this is handled by `src/infrastructure/capture.ts` and `src/infrastructure/share.ts`.
Components don't need to know what platform they're running on.

## Known limitations

- **Video recording**: We only let users *pick* videos from their library. In-app
  video recording is a Phase 7 task — it needs a different Capacitor plugin and
  some UX for trimming.
- **Background uploads**: Uploads pause when the app is backgrounded for too long.
  For very large albums (50+ photos), users should keep the app open.
- **Offline writes**: Auto-save needs network. Offline-first writes with sync are
  Phase 7+.
