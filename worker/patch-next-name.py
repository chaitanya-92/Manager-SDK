#!/usr/bin/env python3
"""KernelSU Next-only: safely patch one app_name resource in a disposable source checkout."""
import os
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

target = Path("upstream/manager/app/src/main/res/values/strings.xml")
name = os.environ.get("ROOTLAB_APP_NAME", "")
if len(name.strip()) < 2 or len(name) > 48 or any(ord(ch) < 32 for ch in name):
    sys.exit("Invalid app name")
if not target.is_file():
    sys.exit("KernelSU Next source layout changed: app string resource not found")
source = target.read_text(encoding="utf-8")
pattern = r'(<string\s+name="app_name"[^>]*>)([^<]*)(</string>)'
updated, count = re.subn(pattern, lambda match: match.group(1) + escape(name.strip()) + match.group(3), source)
if count != 1:
    sys.exit("Expected one KernelSU Next app_name resource; refusing unverified patch")
target.write_text(updated, encoding="utf-8")
print("Applied KernelSU Next display-name-only patch")
