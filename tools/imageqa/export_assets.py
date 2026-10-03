"""Export QA-approved images to the runtime folder and write docs/image-assets.json.

Reads art/export.json (key -> source). Raw candidates never go to public/; only approved entries are
resized (never upscaled), converted to progressive JPEG and written to public/assets/images/<out>.
Pair metrics from art/qa/<pair>/metrics.json are copied into the documentation manifest.

usage: python tools/imageqa/export_assets.py
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "art" / "export.json"
PAIRS = ROOT / "art" / "pairs.json"
OUT_DIR = ROOT / "public" / "assets" / "images"
DOC = ROOT / "docs" / "image-assets.json"
GENERATOR = "Codex CLI 0.158.0 built-in image_gen tool (underlying model name not exposed by the CLI; unverified)"


def main() -> None:
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))["assets"]
    pairs = {p["id"]: p for p in json.loads(PAIRS.read_text(encoding="utf-8"))["pairs"]}
    doc = []
    for a in man:
        if not a.get("approved"):
            print(f"[skip] {a['key']} (not approved)")
            continue
        src = ROOT / a["src"]
        im = Image.open(src).convert("RGB")
        w, h = im.size
        scale = min(1.0, a["max"] / max(w, h))
        if scale < 1:
            im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        dst = OUT_DIR / a["out"]
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, "JPEG", quality=86, optimize=True, progressive=True)
        digest = hashlib.sha256(dst.read_bytes()).hexdigest()[:16]
        entry = {
            "key": a["key"],
            "runtime_path": f"public/assets/images/{a['out']}",
            "role": a["role"],
            "source": a["src"],
            "prompt_file": a.get("prompt"),
            "generator": GENERATOR,
            "size": list(im.size),
            "bytes": dst.stat().st_size,
            "sha256_16": digest,
            "approved": True,
        }
        pid = a.get("pair")
        if pid:
            p = pairs[pid]
            mfile = ROOT / "art" / "qa" / pid / "metrics.json"
            metrics = json.loads(mfile.read_text(encoding="utf-8")) if mfile.exists() else None
            entry["pair"] = {
                "id": pid,
                "normal_master": p["normal"],
                "raw_edit": p["anomaly"],
                "intended_delta": p["intended"],
                "roi_norm": p.get("roi"),
                "composited": bool(p.get("composite")),
                "rejected_attempts": p.get("rejected", []),
                "metrics": metrics,
                "review_sheet": f"art/qa/{pid}/review_sheet.jpg",
            }
        doc.append(entry)
        print(f"[ok] {a['key']} -> {dst.relative_to(ROOT)} {im.size} {dst.stat().st_size // 1024} KB")
    DOC.parent.mkdir(parents=True, exist_ok=True)
    DOC.write_text(json.dumps({"generated_by": "tools/imageqa/export_assets.py", "assets": doc}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {DOC.relative_to(ROOT)} ({len(doc)} assets)")


if __name__ == "__main__":
    main()
