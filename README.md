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

Custom APK compilation, independent signing, and device integration are not implemented. Published upstream APKs are not customized builds. A checksum is not a signature or root verification. A manager can manage a compatible installed engine only with supported authorization; APK installation alone cannot provide root. No credentials are required by this frontend. Do not publish client signing keys or claim runtime success without physical device testing.
