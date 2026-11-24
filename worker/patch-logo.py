#!/usr/bin/env python3
"""Safely apply a PNG icon to either supported Android manager upstream.

Changes only the launcher manifest reference and creates a drawable-nodpi PNG.
Never modifies signing certificates, native root code, or package identifiers.
"""
from __future__ import annotations
import argparse
import binascii
import struct
import sys
import tempfile
import zlib
from pathlib import Path

SIGNATURE = bytes.fromhex("89504e470d0a1a0a")
OLD_ICON = 'android:icon="@mipmap/ic_launcher"'
NEW_ICON = 'android:icon="@drawable/rootlab_custom_icon"'
SIZE_LIMIT = 512 * 1024


def validate_png(path: Path) -> bytes:
    data = path.read_bytes()
    if not 100 <= len(data) <= SIZE_LIMIT:
        raise ValueError("PNG must be 100 bytes to 512 KiB")
    if data[:8] != SIGNATURE or data[12:16] != b"IHDR":
        raise ValueError("File must be a PNG with IHDR")
    width, height = struct.unpack(">II", data[16:24])
    if not (64 <= width <= 2048 and 64 <= height <= 2048):
        raise ValueError("Logo dimensions must be 64 to 2048 pixels")
    if data[-8:-4] != b"IEND":
        raise ValueError("Missing PNG IEND marker")
    return data


def apply_logo(image_path: Path, checkout: Path) -> Path:
    data = validate_png(image_path)
    base = checkout / "manager" / "app" / "src" / "main"
    manifest_path = base / "AndroidManifest.xml"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Android manager manifest not found: {manifest_path}")
    manifest = manifest_path.read_text(encoding="utf-8")
    if manifest.count(OLD_ICON) != 1:
        raise ValueError("Expected exactly one upstream launcher icon")
    target = base / "res" / "drawable-nodpi" / "rootlab_custom_icon.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    manifest_path.write_text(manifest.replace(OLD_ICON, NEW_ICON, 1), encoding="utf-8")
    return target


def chunk(kind: bytes, payload: bytes) -> bytes:
    return (struct.pack(">I", len(payload)) + kind + payload +
            struct.pack(">I", binascii.crc32(kind + payload) & 0xFFFFFFFF))


def fixture(path: Path) -> None:
    """Generate a deterministic 128px PNG fixture with standard-library only."""
    size = 128
    rows = b"".join(
        b"\0" + b"".join(
            bytes((28 + x // 4, 69 + y // 6, 124, 255))
            for x in range(size)
        ) for y in range(size)
    )
    image = SIGNATURE + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    image += chunk(b"IDAT", zlib.compress(rows, level=9)) + chunk(b"IEND", b"")
    path.write_bytes(image)


def self_test() -> None:
    with tempfile.TemporaryDirectory() as folder:
        d = Path(folder)
        img = d / "fixture.png"
        fixture(img)
        assert validate_png(img) == img.read_bytes()
        checkout = d / "upstream"
        base = checkout / "manager/app/src/main"
        base.mkdir(parents=True)
        (base / "AndroidManifest.xml").write_text(
            "<manifest><application " + OLD_ICON + " /></manifest>", encoding="utf-8")
        patched = apply_logo(img, checkout)
        assert patched.read_bytes() == img.read_bytes()
        assert NEW_ICON in (base / "AndroidManifest.xml").read_text(encoding="utf-8")
        try:
            apply_logo(img, checkout)
        except ValueError:
            pass
        else:
            raise AssertionError("A repeated icon patch must fail")
        img.write_bytes(b"not a png")
        try:
            validate_png(img)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid PNG was accepted")
    print("Root Lab PNG launcher icon tests passed")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--fixture", metavar="PNG_DESTINATION")
    parser.add_argument("input", nargs="?")
    parser.add_argument("checkout", nargs="?")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    elif args.fixture:
        fixture(Path(args.fixture))
    else:
        if not args.input or not args.checkout:
            parser.error("Usage: patch-logo.py logo.png upstream-checkout")
        patched = apply_logo(Path(args.input), Path(args.checkout))
        print(f"Root Lab Android launcher PNG installed: {patched}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        print(f"Root Lab icon customization failed: {error}", file=sys.stderr)
        sys.exit(1)
