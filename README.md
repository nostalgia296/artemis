# Artemis

PFS archive tool with CLI and Android app.

## CLI

```bash
## extract all pfs like xx.pfs xx.pfs.001 etc.
pfs extract *pfs*

## pack something into .pfs use `create` command
pfs create inputdir/
```

## Android App

### Prerequisites
- Android SDK (compileSdk 35)
- Android NDK r29+
- Go 1.26+

### Build

1. Cross-compile Go shared library:
```bash
./build-android.sh
```

2. Build APK:
```bash
cd android && ./gradlew assembleDebug
```

The APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

> note:
If you are working in a non-Termux environment, please remove `android.aapt2FromMavenOverride=/data/data/com.termux/files/usr/opt/android-sdk/build-tools/35.0.0/aapt2`.