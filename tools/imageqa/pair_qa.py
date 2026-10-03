"""Normal/anomaly image-pair QA for 13F: Night Audit.

For every pair in art/pairs.json:
  1. load NORMAL master + ANOMALY edit (edit may come back at a different resolution)
  2. align the anomaly to the normal (ECC affine, falls back to resize)
  3. compute a perceptual change mask (SSIM map + blurred Lab deltaE), ignoring micro-noise
  4. measure change inside vs. outside the intended ROI
  5. optionally build a ROI-composited anomaly: normal pixels everywhere except a feathered ROI
     (guarantees zero drift outside the intended semantic target)
  6. write metrics JSON + a side-by-side review sheet to art/qa/<id>/

The automated verdict is advisory: visual review by the agent is still mandatory.

usage: python tools/imageqa/pair_qa.py [pair_id ...]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PAIRS = ROOT / "art" / "pairs.json"
QA_DIR = ROOT / "art" / "qa"
WORK_W = 640  # analysis resolution (suppresses harmless micro-variation)


def imread(p: Path) -> np.ndarray:
    data = np.fromfile(str(p), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(p)
    return img


def imwrite(p: Path, img: np.ndarray, quality: int = 92) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    ext = p.suffix.lower()
    params = [cv2.IMWRITE_JPEG_QUALITY, quality] if ext in (".jpg", ".jpeg") else []
    ok, buf = cv2.imencode(ext, img, params)
    if not ok:
        raise RuntimeError(f"encode failed {p}")
    buf.tofile(str(p))


def ssim_map(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    k = (11, 11)
    mu_a = cv2.GaussianBlur(a, k, 1.5)
    mu_b = cv2.GaussianBlur(b, k, 1.5)
    saa = cv2.GaussianBlur(a * a, k, 1.5) - mu_a**2
    sbb = cv2.GaussianBlur(b * b, k, 1.5) - mu_b**2
    sab = cv2.GaussianBlur(a * b, k, 1.5) - mu_a * mu_b
    num = (2 * mu_a * mu_b + c1) * (2 * sab + c2)
    den = (mu_a**2 + mu_b**2 + c1) * (saa + sbb + c2)
    return num / den


def align(normal: np.ndarray, anomaly: np.ndarray) -> tuple[np.ndarray, dict]:
    """Resize anomaly to the normal's size, then refine with ECC affine alignment."""
    h, w = normal.shape[:2]
    info = {"anomaly_size": list(anomaly.shape[1::-1]), "normal_size": [w, h]}
    ar_n = w / h
    ar_a = anomaly.shape[1] / anomaly.shape[0]
    info["aspect_delta"] = round(abs(ar_n - ar_a), 4)
    resized = cv2.resize(anomaly, (w, h), interpolation=cv2.INTER_AREA)
    g1 = cv2.cvtColor(cv2.resize(normal, (WORK_W, int(WORK_W * h / w))), cv2.COLOR_BGR2GRAY)
    g2 = cv2.cvtColor(cv2.resize(resized, (WORK_W, int(WORK_W * h / w))), cv2.COLOR_BGR2GRAY)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(g1, g2, warp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), None, 5)
        scale = w / WORK_W
        full = warp.copy()
        full[0, 2] *= scale
        full[1, 2] *= scale
        aligned = cv2.warpAffine(resized, full, (w, h), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
        info["ecc_shift_px"] = [round(float(full[0, 2]), 2), round(float(full[1, 2]), 2)]
        info["ecc_scale"] = [round(float(full[0, 0]), 4), round(float(full[1, 1]), 4)]
        # Edits only drift by a few pixels. A large transform means ECC locked onto the edit itself
        # (e.g. a removed person) and would smear the image: reject it and keep the plain resize.
        plausible = (
            abs(full[0, 0] - 1) < 0.03 and abs(full[1, 1] - 1) < 0.03
            and abs(full[0, 1]) < 0.03 and abs(full[1, 0]) < 0.03
            and abs(full[0, 2]) < 0.03 * w and abs(full[1, 2]) < 0.03 * h
        )
        if not plausible:
            info["ecc"] = "rejected_implausible_transform"
            return resized, info
        return aligned, info
    except cv2.error:
        info["ecc"] = "failed"
        return resized, info


def change_mask(normal: np.ndarray, aligned: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h, w = normal.shape[:2]
    wh = int(WORK_W * h / w)
    a = cv2.resize(normal, (WORK_W, wh), interpolation=cv2.INTER_AREA)
    b = cv2.resize(aligned, (WORK_W, wh), interpolation=cv2.INTER_AREA)
    a = cv2.GaussianBlur(a, (5, 5), 1.2)
    b = cv2.GaussianBlur(b, (5, 5), 1.2)
    s = ssim_map(cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), cv2.cvtColor(b, cv2.COLOR_BGR2GRAY))
    la = cv2.cvtColor(a, cv2.COLOR_BGR2LAB).astype(np.float32)
    lb = cv2.cvtColor(b, cv2.COLOR_BGR2LAB).astype(np.float32)
    de = np.sqrt(((la - lb) ** 2).sum(axis=2))
    score = np.maximum((1 - s) / 0.45, de / 22.0)  # >1 == meaningful change
    mask = (score > 1.0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask, score


def roi_mask(shape: tuple[int, int], roi: list[float] | None) -> np.ndarray:
    h, w = shape
    m = np.zeros((h, w), np.uint8)
    if roi:
        x0, y0, x1, y1 = roi
        m[int(y0 * h) : int(y1 * h), int(x0 * w) : int(x1 * w)] = 1
    return m


def analyse(pair: dict) -> dict:
    pid = pair["id"]
    out = QA_DIR / pid
    out.mkdir(parents=True, exist_ok=True)
    normal = imread(ROOT / pair["normal"])
    anomaly = imread(ROOT / pair["anomaly"])
    aligned, ainfo = align(normal, anomaly)
    mask, score = change_mask(normal, aligned)
    mh, mw = mask.shape
    roi = roi_mask((mh, mw), pair.get("roi"))
    inside = roi.sum()
    outside = roi.size - inside
    changed_in = int((mask & roi).sum())
    changed_out = int((mask & (1 - roi)).sum())
    # largest changed connected component outside ROI
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask & (1 - roi), 8)
    largest_out = int(stats[1:, cv2.CC_STAT_AREA].max()) if n > 1 else 0
    comps = []
    for i in range(1, n):
        x, y, cw, ch, area = stats[i]
        if area >= 0.0015 * mask.size:
            comps.append({"bbox_norm": [round(x / mw, 3), round(y / mh, 3), round((x + cw) / mw, 3), round((y + ch) / mh, 3)], "area_frac": round(area / mask.size, 4)})
    metrics = {
        "id": pid,
        "align": ainfo,
        "changed_total_frac": round(float(mask.mean()), 4),
        "changed_inside_roi_frac": round(changed_in / max(1, inside), 4),
        "changed_outside_roi_frac": round(changed_out / max(1, outside), 4),
        "largest_outside_component_frac": round(largest_out / mask.size, 4),
        "outside_components": comps[:12],
    }
    th = {"max_outside": 0.02, "max_outside_component": 0.006, "min_inside": 0.04, **pair.get("thresholds", {})}
    raw_pass = (
        metrics["changed_outside_roi_frac"] <= th["max_outside"]
        and metrics["largest_outside_component_frac"] <= th["max_outside_component"]
        and metrics["changed_inside_roi_frac"] >= th["min_inside"]
    )
    metrics["thresholds"] = th
    metrics["raw_edit_pass"] = bool(raw_pass)

    final = aligned
    if pair.get("composite") and pair.get("roi"):
        # Feathered ROI composite: normal pixels outside the ROI, edited pixels inside.
        h, w = normal.shape[:2]
        if pair.get("mask_mode", "change") == "change":
            # Use only the detected meaningful change inside the ROI (dilated), not the whole rectangle,
            # so unrelated subjects that merely overlap the ROI keep their original pixels.
            cm = (mask & roi).astype(np.uint8)
            n2, lab2, st2, _ = cv2.connectedComponentsWithStats(cm, 8)
            keep = np.zeros_like(cm)
            min_comp = pair.get("min_component", 0.002)  # small targets (e.g. distant figure) need a lower floor
            for i in range(1, n2):
                if st2[i, cv2.CC_STAT_AREA] >= min_comp * cm.size:
                    keep[lab2 == i] = 1
            grow = max(3, int(WORK_W * pair.get("grow", 0.02)))
            keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow * 2 + 1, grow * 2 + 1)))
            keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
            rm = cv2.resize(keep.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
            imwrite(out / "composite_mask.png", (rm * 255).astype(np.uint8))
        else:
            rm = roi_mask((h, w), pair["roi"]).astype(np.float32)
        feather = max(9, int(min(w, h) * pair.get("feather", 0.03)) | 1)
        rm = cv2.GaussianBlur(rm, (feather, feather), 0)
        rm = rm[..., None]
        final = (aligned.astype(np.float32) * rm + normal.astype(np.float32) * (1 - rm)).astype(np.uint8)
        imwrite(out / "anomaly_composited.png", final)
        m2, _ = change_mask(normal, final)
        roi2 = roi_mask(m2.shape, pair["roi"])
        metrics["composited_outside_roi_frac"] = round(float((m2 & (1 - roi2)).sum() / max(1, (1 - roi2).sum())), 4)
        metrics["composited_inside_roi_frac"] = round(float((m2 & roi2).sum() / max(1, roi2.sum())), 4)
        metrics["composite_pass"] = bool(metrics["composited_outside_roi_frac"] <= th["max_outside"] and metrics["composited_inside_roi_frac"] >= th["min_inside"])

    # Review sheet: normal | anomaly(final) | heatmap | mask+roi
    th_w = 560
    def fit(img):
        return cv2.resize(img, (th_w, int(th_w * img.shape[0] / img.shape[1])), interpolation=cv2.INTER_AREA)

    heat = np.clip(score / 2.0, 0, 1)
    heat = cv2.applyColorMap((heat * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
    mview = cv2.cvtColor(mask * 255, cv2.COLOR_GRAY2BGR)
    if pair.get("roi"):
        x0, y0, x1, y1 = pair["roi"]
        cv2.rectangle(mview, (int(x0 * mw), int(y0 * mh)), (int(x1 * mw), int(y1 * mh)), (0, 200, 255), 2)
        cv2.rectangle(heat, (int(x0 * mw), int(y0 * mh)), (int(x1 * mw), int(y1 * mh)), (0, 255, 0), 2)
    tiles = [fit(normal), fit(final), fit(heat), fit(mview)]
    hmax = max(t.shape[0] for t in tiles)
    tiles = [cv2.copyMakeBorder(t, 0, hmax - t.shape[0], 0, 8, cv2.BORDER_CONSTANT, value=(30, 30, 30)) for t in tiles]
    sheet = np.hstack(tiles)
    imwrite(out / "review_sheet.jpg", sheet)
    imwrite(out / "anomaly_aligned.png", aligned)
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    return metrics


def main() -> None:
    pairs = json.loads(PAIRS.read_text(encoding="utf-8"))["pairs"]
    want = set(sys.argv[1:])
    for p in pairs:
        if want and p["id"] not in want:
            continue
        if not (ROOT / p["anomaly"]).exists():
            print(f"[skip] {p['id']}: anomaly missing")
            continue
        m = analyse(p)
        verdict = "PASS" if (m.get("composite_pass") if "composite_pass" in m else m["raw_edit_pass"]) else "REVIEW"
        print(f"[{verdict}] {p['id']}: inside={m['changed_inside_roi_frac']} outside={m['changed_outside_roi_frac']} "
              f"largestOut={m['largest_outside_component_frac']} composited_out={m.get('composited_outside_roi_frac')}")


if __name__ == "__main__":
    main()
