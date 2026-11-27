# nSedo Video

Bangla-first video editor for the web and Android. You add a clip, then say what you want in plain Bangla or English. nSedo turns that into a plan you can edit, previews it, and exports an MP4 on the device.

The site is published at [robinwebc.github.io/nsedo-video](https://robinwebc.github.io/nsedo-video/).

## What works without an API key

- Timeline: trim, split, delete, reorder, and join several clips
- Aspect presets: original, 16:9, 9:16, 1:1
- Speed, volume, mute, rotate
- Colour: brightness, contrast, saturation, and warm / cool / mono / vivid
- Text and title overlays, with Bangla shaping in the preview and in the export
- Background music with level, fade in, and fade out
- Undo and redo
- MP4 export with draft, standard, and high presets
- SRT import and export
- A built-in Bangla and English command parser, including:
  - `প্রথম ৫ সেকেন্ড কেটে দাও`
  - `add Bangla subtitles`
  - `make it 9:16 for Reels`
  - `speed 1.5x`
  - `add background music`
  - `remove silence`
  - `add text title`
- Suggested actions: cut the opening, 9:16, speed, silence, subtitles, title, music, highlight reel
- Light and dark theme, Bangla by default, English toggle
- Projects stay in this browser (IndexedDB). Nothing is uploaded to an nSedo server

## What needs a key you configure

Both calls are optional. With no key, the rule parser still plans edits, and you can type subtitles or import an SRT.

| Task | Endpoint | When media leaves the device |
| --- | --- | --- |
| Natural-language plan | OpenAI-compatible `POST {base}/chat/completions` | Only the command text and a short project summary (durations and clip ids). Not the video. |
| Auto captions | Whisper-compatible `POST {base}/audio/transcriptions` | A 16 kHz mono WAV of the audio, only after you ask for subtitles. |

If the model is missing, errors, or returns nothing usable, nSedo uses the offline parser.

### Configure it

Open **সেটিংস**. Keys are stored in `localStorage` on this device. Do not put a key in the repository or in `VITE_*` for the public GitHub Pages build: that bundle is visible to everyone.

The address must be `https`, or `http://localhost` / `http://127.0.0.1`. It also has to allow browser CORS. `https://api.openai.com` does not accept calls from a web page. Use a local OpenAI-compatible server (LM Studio, Ollama behind a CORS-capable proxy you run yourself, or similar) or a provider that sends `Access-Control-Allow-Origin` for your site.

Optional build-time defaults, all empty in git, are listed in `.env.example`.

Silence removal and the highlight reel do not need a key. They run FFmpeg on the device. Highlight keeps the longest non-silent stretches, up to about 15 seconds.

## Privacy

Video, music, and the export stay on the device. The only network transfer is the one you turn on in settings, to the address you typed. The editor says this on the home screen and above the timeline.

## Web

```bash
npm ci
npm test
npm run dev
```

Production build uses base path `/nsedo-video/` for GitHub Pages. `npm run build` copies a single-thread ffmpeg.wasm core into `dist/ffmpeg` (the binaries are not committed). Pages cannot set COOP/COEP headers, so `public/coi-serviceworker.js` reloads the site into cross-origin isolation, which ffmpeg.wasm needs for `SharedArrayBuffer`. The dev server sends those headers itself and does not register the worker.

Enable GitHub Pages for this repository with **Source: GitHub Actions**. `.github/workflows/pages.yml` tests, builds, and deploys on `main`.

## Android

The Android app is the same interface in a Capacitor shell (`app.nsedo.video`), not a second editor.

ffmpeg.wasm is a poor fit for the Android WebView: the view often cannot turn on cross-origin isolation, so `SharedArrayBuffer` never appears and the wasm encoder will not start. Export, silence detection, and caption audio extraction therefore go through a small plugin, `NsedoFfmpeg`, which runs [FFmpegKit](https://github.com/ffmpegkit-maintained/ffmpeg) on the phone (`dev.ffmpegkit-maintained:ffmpeg-kit-full:8.1.9`, LGPL-3.0). The filter graph is the same code the website uses. The published builds include `arm64-v8a` and `x86_64` only, so 32-bit phones are not supported. Finished videos are saved to `Movies/nSedo` on Android 10 and newer.

```bash
npm run build:android
npx cap sync android
cd android && ./gradlew assembleRelease
```

`build:android` omits the wasm core so the APK does not carry a second encoder.

### Signing

No keystore is in this repository. `.github/workflows/android.yml` builds `assembleRelease` and uploads `nSedo-Video.apk`.

If these Actions secrets exist, the release is signed with your key:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

If they are absent, Gradle signs that same release APK with the debug keystore it creates on the runner. That file installs for testing. It is not a Play upload key. A push to `main` also attaches `nSedo-Video.apk` to GitHub Release `v1.0.0`.

## Tests

```bash
npm test
```

Vitest covers the Bangla/English parser, applying edit operations (including undo history), silence and highlight planning, SRT, the model JSON sanitizer, and the FFmpeg argument builder.

## Known limitations

- Very long or very large files can run out of memory. The wasm encoder is comfortable with short clips; native FFmpeg on Android handles more, but not a feature-length timeline.
- The preview is the browser video element (trim, speed, crop, colour, text). The MP4 is produced by FFmpeg and can differ slightly, especially text size.
- Auto captions need a CORS-capable Whisper-compatible endpoint. Bangla recognition depends on that model.
- `api.openai.com` cannot be called directly from this site.
- Android export uses whatever H.264 encoder the LGPL FFmpeg build reports (`libx264`, then `libopenh264`, then the built-in `mpeg4` encoder). The website build of ffmpeg.wasm generally has `libx264`.
- Silence detection uses FFmpeg `silencedetect`. A quiet speech track can be cut, and a noisy room can be kept.
- The highlight reel is a length heuristic, not a trained ranking model.
- Music has to be a file you pick. The command only sets level and fades.
- 32-bit Android ABIs are not in the FFmpegKit packages used here.
- GitHub Pages deploy stays off until the repository’s Pages source is set to GitHub Actions.
