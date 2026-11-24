#!/usr/bin/env bash
set -euo pipefail
case "$1" in
 kernelsu)
   rustup target add aarch64-linux-android x86_64-linux-android
   for target in aarch64-linux-android x86_64-linux-android; do
     (source .github/scripts/setup-rust-build.sh "$target" 26
      cargo build --target "$TRIPLE" --release --manifest-path userspace/ksud/Cargo.toml
      test -s "target/$target/release/ksud")
   done
   ;;
 next)
   rustup target add aarch64-linux-android x86_64-linux-android
   command -v cross >/dev/null || { echo "Install reviewed cross version before building"; exit 1; }
   clang --target=aarch64-linux-gnu -c -nostdlib -o userspace/ksud/.lkm_image_bootstrap.o userspace/ksud/src/lkm_image_bootstrap.S
   ndk_sysroot="$ANDROID_NDK_ROOT/toolchains/llvm/prebuilt/linux-x86_64/sysroot"
   export BINDGEN_EXTRA_CLANG_ARGS_aarch64_linux_android="--sysroot=$ndk_sysroot -I$ndk_sysroot/usr/include/aarch64-linux-android -I$ndk_sysroot/usr/include"
   for target in aarch64-linux-android x86_64-linux-android; do
     cross build --target "$target" --release --manifest-path userspace/ksud/Cargo.toml
     test -s "userspace/ksud/target/$target/release/ksud"
   done
   mkdir -p manager/app/src/main/jniLibs/{arm64-v8a,x86_64}
   cp userspace/ksud/target/aarch64-linux-android/release/ksud manager/app/src/main/jniLibs/arm64-v8a/libksud.so
   cp userspace/ksud/target/x86_64-linux-android/release/ksud manager/app/src/main/jniLibs/x86_64/libksud.so
   ;;
 *) exit 2 ;;
esac