#!/bin/bash
set -e

NDK=${ANDROID_NDK_HOME:-/data/data/com.termux/files/home/android-ndk-r29}

# Detect host platform for NDK prebuilt directory
HOST_ARCH=$(uname -m)
case "$HOST_ARCH" in
    x86_64)  HOST_TAG="linux-x86_64" ;;
    aarch64) HOST_TAG="linux-aarch64" ;;
    *)       echo "Unsupported host architecture: $HOST_ARCH"; exit 1 ;;
esac

TOOLCHAIN=$NDK/toolchains/llvm/prebuilt/$HOST_TAG
SYSROOT=$TOOLCHAIN/sysroot
API=26

# Verify toolchain exists
if [ ! -d "$TOOLCHAIN" ]; then
    echo "Error: NDK toolchain not found at $TOOLCHAIN"
    exit 1
fi

# Use clang-21 directly (wrapper scripts may not be executable by cgo)
CLANG=$TOOLCHAIN/bin/clang-21
if [ ! -f "$CLANG" ]; then
    echo "Error: clang not found at $CLANG"
    exit 1
fi

build_arch() {
    local GOARCH=$1
    local TARGET=$2
    local OUT_DIR=$3
    local GOARM=${4:-}

    echo "Building for $GOARCH ($TARGET)..."
    mkdir -p "$OUT_DIR"

    env \
        CGO_ENABLED=1 \
        GOOS=android \
        GOARCH=$GOARCH \
        ${GOARM:+GOARM=$GOARM} \
        CC=$CLANG \
        CGO_CFLAGS="--target=$TARGET --sysroot=$SYSROOT" \
        CGO_LDFLAGS="--target=$TARGET --sysroot=$SYSROOT" \
        go build -buildmode=c-shared \
            -o "$OUT_DIR/libartemis-jni.so" \
            ./go-jni/

    echo "  -> $OUT_DIR/libartemis-jni.so"
}

build_arch arm64  aarch64-linux-android26    android/app/src/main/jniLibs/arm64-v8a
build_arch arm    armv7a-linux-androideabi26  android/app/src/main/jniLibs/armeabi-v7a 7
build_arch amd64  x86_64-linux-android26     android/app/src/main/jniLibs/x86_64

echo "Done. Libraries built successfully."
