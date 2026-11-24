# Manager SDK

Local-first terminal workspace for KernelSU and KernelSU Next project preparation. Uses React, DaisyUI, Radix Select (the primitive used by shadcn/ui), Lucide and React Bits AnimatedContent.

## Run

Node 22.12+ recommended.

```sh
npm install
npm run dev
npm test
npm run build
```

Features: validated project manifests, keyboard-accessible framework selector, panel-local terminal scrolling, official upstream APK release lookup, and local SHA-256/ZIP header inspection. The terminal accepts workspace commands, not arbitrary shell execution. The `releases` command opens the upstream release browser.

## Limitations

The local build worker is implemented but has not yet been validated against a complete upstream native build. Device integration is not automated. Published upstream APKs are not customized builds. A checksum is not a signature or root verification. A manager can manage a compatible installed engine only with supported authorization; APK installation alone cannot provide root. No credentials are required by this frontend. Do not publish client signing keys or claim runtime success without physical device testing.

## Local build worker

Run the Vite development server on an x86_64 Linux machine with JDK 21, Git, Python 3 (with json-with-comments installed), Rust, Android SDK/build-tools and the upstream-required NDK. For Next, install Docker, clang and the reviewed cross tool. Set ANDROID_HOME and ANDROID_NDK_HOME. Optional upstream forking needs authenticated gh CLI. Do not expose this loopback development server to the public internet. The workspace on macOS remains usable for configuration and inspection, but native builds are disabled there. Client signing keys are stored under ~/.manager-sdk/keys with restricted permissions; back them up securely. Only use trusted reviewed source revisions. The worker signs the finished APK locally, verifies its signature and metadata, and exposes a download only on success. Jobs are session-local; output remains on disk. The deterministic failure analyzer suggests fixes; it does not use AI or modify arbitrary code. Device acceptance remains manual: see docs/device-acceptance.md. No LKM delivery or root concealment is provided.
