# Validation record — 13층: 야간점검 / 13F: Night Audit

Only things that were actually run are listed here. Anything not run is under "Not verified".

## Environment

| Item | Value |
| --- | --- |
| Validation date | 2026-09-29 (KST, +09:00); final run 20:08 |
| OS | Microsoft Windows 11 Pro 10.0.26300, PowerShell 5.1 |
| Node / npm | Node v24.13.0 / npm 11.5.2 |
| Browser | Google Chrome 154.0.8037.58, headless, driven by playwright-core 1.63.0 (`--use-angle=d3d11`) |
| Dependencies (pinned) | three 0.186.1; dev: typescript 7.0.2, vite 8.3.1, vitest 5.0.2, playwright-core 1.63.0, @types/three 0.186.0, @types/node 24.19.0 |
| Image QA | Python 3.13.0, Pillow 12.2.0, OpenCV 4.13.0, NumPy 2.5.0 |
| Image generation | Codex CLI 0.158.0 (`codex exec`, agent model `gpt-6-luna` per the log header) using its built-in `image_gen` tool, called by `tools/imagegen/codex-image.ps1`. The underlying image model name is **not exposed** by the tool and was not verified. No OpenAI API key or direct GPT Image API call was used. |

## Commands executed and results (final state)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | clean, no errors |
| `npx vitest --run` | 2 files, **30/30 passed** |
| `npm run build` | OK — `dist/index.html` 0.73 kB, CSS 23.71 kB (gzip 5.95), JS 791.41 kB (gzip 224.16); dist total 26 files / 5.7 MB |
| `node tests/e2e/ui-audit.mjs` | 39 screens (title, settings, 9 tablet tabs, report form, pause × 1366×768 / 1920×1080 / 2560×1440): **0** clipped texts, **0** off-screen texts, **0** texts < 12 px, no stray English, no console errors |
| `node tests/e2e/functional.mjs` | **34/34 passed** (see list below) |
| `node tests/e2e/playthrough.mjs good PTGOOD 1920x1080` | 11/11 checks, ending **good (퇴근)**, contamination 0 |
| `node tests/e2e/playthrough.mjs bad PTBAD 1366x768` | 7/7 checks, ending **bad (상주 관리인)**, contamination 100 |
| `node tests/e2e/playthrough.mjs secret PTSECRET 2560x1440` | 7/7 checks, ending **secret (1301호)**, D1–D4 collected, 3/3 optionals correct |
| `node tests/e2e/playthrough.mjs good <seed> 1600x900` for NIGHT0930, K7Q2, ZX91 | each 11/11, ending good (different random incidents per seed, listed below) |
| `node tests/e2e/prod-smoke.mjs` (against `vite preview`) | **11/11** — loads in ~280 ms, Korean title menu, no debug API or overlay, briefing → shift → W walk → Tab tablet → Esc pause, 25 requests all same-origin, 0 failed responses, 0 console errors |
| `node tests/e2e/anomaly-gallery.mjs` | 44 anomaly screenshots (6 audio/runtime-only skipped, covered by functional tests), 0 errors; reviewed as contact sheets |
| `python tools/imageqa/pair_qa.py` | 5/5 pairs PASS (metrics below) |
| `python tools/imageqa/export_assets.py` | 21 approved assets written to `public/assets/images`, `docs/image-assets.json` rewritten |

The one-shot orchestrator `node tests/e2e/run-e2e.mjs` (= `npm run e2e`) ran UI audit, functional, 3 playthroughs and prod smoke in one go: all 6 suites PASS (UI 105 s, functional 76 s, good 36 s, bad 33 s, secret 48 s, prod 7 s).

### What the playthroughs do

Real UI: title → 새 근무 시작 → briefing (seed typed into the field) → 근무 시작; every report is filed by clicking the tablet (정상 / 이상현상 있음 → category → 보고 제출); pickups and doors use the real crosshair raycast + `E` key; the shift ends by pressing `E` at the 1F entrance at 06:00, which shows the ending screen.
Shortcuts (automation only): the player is teleported next to each incident site (the game's own zone check then detects arrival — no fallback was needed in any run) and idle time between calls is skipped with the dev clock skip.

Additional checks inside the good run: photo taken on site is stored with the incident id and `evidenceOf`; a deliberate false alarm on the normal call s02 raised contamination by exactly +10 and later correct reports brought it back to 0; save via 근무 일지 (desk) → page reload → 이어하기 restored slot 8, clock 02:01, contamination, 8 reports and seed exactly.

### Seeds and incidents seen (anomaly per slot)

- PTGOOD: vending_duplicate, (normal), shoes_row, (normal), family_extra_person, lockers_open, cctv_only_figure, follow_steps, ceiling_low, delivery_vacant, breaker_13*, steps_above, ceremony_both*, elevator_log_13, resident_smile*, ref_corridor, (normal), floor_13, cctv_13, identity_record (* optional)
- NIGHT0930: …window_figure, follow_steps, directory_extra_unit, door_ajar_watch, (normal s11), log_future_entry…
- K7Q2: …extra_door, prop_missing, window_walled, exit_sign_reversed, steps_above, cctv_timestamp…
- ZX91: …shoes_row, stair_sign, corridor_extended, prop_missing, mirror_figure, cctv_timestamp…

Categories exercised in real play across these runs: OBJECT, GEOMETRY, IMAGE (family photo pair, ceremony pair vs Tier-A original), HUMAN (CCTV-only figure, mirror, ajar door, resident portrait pair), TEMPORAL (CCTV timestamp, future log entry), AUDIO, SYSTEM, META (live reference photo corrupted vs archive original).

### Functional checks (functional.mjs, 34)

Archive binder, master key, desk-log checkpoint, CCTV monitors, parcel lockers, entrance locked during shift; hall call brings the car 3F→1F; car panel button ride 1F→12F carries the player (21 s) and both trips are logged; 1204 unlocks with the master key; D3, D1 pickups; filing cabinet locked without key, archive key from the electrical room, D2; 1301 unlocks after D1–D3; breaker panel normal; 13F button only after the story opens it, ride 1F→13F, arrival shock fires once; 1301 door, family photo sets `saw1301`, D4; runtime anomalies: room silence only on its floor, follow-steps echoes while walking (real `W` key), uncalled elevator arrives and is not logged as a player trip, vacant-unit TV murmur mutes on doorbell, footsteps above 12F, stair loop (down from F lands on F), window figure vanishes on approach, ajar door slams (one sting), mirror figure visible only in the mirror; no page errors.

## Image assets

- Generated with image_gen: **22** raw images = 16 normal masters + 6 edits (`art/raw`).
- Shipped (approved): **21** runtime images (`public/assets/images`, see `docs/image-assets.json`).
- Approved normal/anomaly pairs: **5** — family photo (+ extra person), 이순자 portrait (smile), elevator ad (rooftop figure), completion-ceremony photo (gaze), 박정호 staff photo (empty). Every anomaly is an edit of the approved master.

| Pair | changed inside ROI | changed outside ROI | Composite outside ROI |
| --- | --- | --- | --- |
| family_photo | 0.472 | 0.000 | yes (normal pixels outside the change mask) |
| leesoonja_smile | 0.384 | 0.000 | yes |
| elevator_ad_rooftop | 0.021 | 0.000 | yes |
| ceremony_gaze | 0.040 | 0.000 | no (raw edit, aligned) |
| parkjeongho_empty | 0.567 | 0.000 | no (raw edit, plain resize) |

Visual review: every pair's review sheet / crops were inspected by the agent; in this session the 박정호 normal/empty pair was re-inspected after the alignment fix below (backdrop tone and texture match, no residue of the person).

## Failed attempts and fixes

Earlier in development:
- Piping the prompt to `codex.ps1` via stdin hung; the helper now calls `codex.js` through `node` with an argument array and `-NoProfile`, with `$ErrorActionPreference = "Continue"` so Codex's stderr progress is not treated as a failure.
- Elevator ad edit v1: the rooftop figure was only a few pixels tall and unreadable in game → rejected (`art/pairs.json`), v2 approved; QA got a per-pair `min_component` so the small figure is detected.
- Family photo: compositing the whole ROI carried unrelated pixel drift → composite mask now uses only the detected change components inside the ROI.
- Five anomalies were removed from the registry during QA (obj_light_warm, hum_cctv_player_absent, sys_door_plate_13, tmp_caption_future, tmp_cctv_lobby_daylight) together with their builder/runtime branches; the registry has 50.
- Corridor far end was nearly black: the 10-light pool wasted slots on other storeys → lights now come from the current storey only (stairwell: ±1); fog range widened to 7–32 m in both the world and the reference renderer so reference photos match.
- Dev race: `data-ready` was set before the debug API was installed.

This session:
- **Image QA bug:** ECC alignment for the 박정호 "empty" edit diverged (scale 0.18 / 4.77, shift −2700 px) because the person removal dominates the image; the shipped image was a smeared warp of the backdrop. `align()` now rejects implausible transforms (>3 % scale/shear/shift) and keeps the plain resize; asset re-exported and re-inspected.
- **Elevator:** the door "safety edge" zone extended 0.45 m into the car, so a player standing in front of the car panel held the doors open forever and the car never left. Zone reduced to the threshold (−0.28…+0.3 m). Found by the functional test.
- **Ending screen:** flex centring clipped the title off the top when the report list is taller than the screen (all resolutions); now `margin: auto` + scrolling. Verified title top at 70 px on 1366×768.
- **Korean UI:** at 1366×768 several labels rendered at 9.8–11.9 px. Root size minimum raised to 16 px and the smallest classes to ≥0.75 rem; `word-break: keep-all` so Hangul wraps by word (removed single-syllable orphan lines in category help); HUD clock hidden under the tablet.
- Anomaly-gallery viewpoint for `sys_delivery_vacant` was inside a wall (test-only fix).
- **Z-fighting:** added a geometric scanner (`npm run qa:zfight`; dev-only `__na13f.zfight`). It finds coplanar (≤1.5 mm apart), same-facing, overlapping triangles on every floor, in the baseline and with every anomaly forced. The first scan found 2,262 overlaps. The largest, about 24 m² per floor, was the corridor wainscot, baseboard and chair rail sitting flush with the wall face.
  - Fixes:
    - trims moved in front of the wall at distinct depths
    - the duplicate corridor east wall removed (the stair wall already closes it)
    - room side walls and ceilings stopped at the back of the corridor wall
    - elevator landing and unit door frames inset 5 mm from the opening caps
    - overlapping elevator door leaves offset 4 mm
    - the parcel-locker LCD block was mis-placed and overlapped a locker; now sits exactly in its slot
    - mailbox boxes overlapping each other; the parcel tower piercing the ceiling; the service counter flush with the window sill; parcel tape only 0.4 mm proud
    - static batched boxes now use world-space UVs, so same-material coplanar faces render identical texels
    - camera near plane 0.05 → 0.1 (main, CCTV, reference renderer)
  - Result: in all visible areas no overlap larger than 0.01 m² remains. The largest leftovers (≤0.08 m²) are in places the player cannot see: above ceilings, inside wall volumes, the top of a door leaf hidden by the lintel.
  - Re-verified after the change: unit 30/30, functional 34/34, secret playthrough 7/7, build OK. The corridor, control room, elevator and 13F screenshots were re-inspected; the README screenshots were refreshed.
- **Elevator seen through the wall while travelling (user report):**
  - Cause: the car's front 15 cm (front wall, side-wall ends, ceiling) sat inside the hall back wall, and its front face was coplanar with the wall face. The car floor also stuck 4 cm out into the hall, so the car flickered through the wall and its floor edge slid past while moving.
  - Fix: the landing wall is now built in front of the shaft (z −3.6…−3.45). The car floor ends at the car front. The landing leaves run inside the wall and slide into its pockets instead of sliding across the wall face.
  - Found along the way:
    - the hall floor indicator plane was hidden inside its housing, so the floor number never showed on the landing
    - stair dividers of stacked floors overlapped by 0.4 m
    - stair wall tops were coplanar with the landing floor of the storey above
    - west-window city backdrops of stacked floors were coplanar; now only the current floor's backdrop is shown
  - The scanner now also checks the car together with the floors at 10 car heights (parked and between floors). A ray "leak test" fires 6,664 rays per case from the elevator hall with the doors shut: 0 rays hit the car in all 10 cases.
  - Final scan: 50 residual overlaps totalling 0.33 m², the largest 0.058 m². All are hidden: wall end caps inside the next storey's slab, and faces above ceilings.
  - Re-verified: functional 34/34, good playthrough 11/11 at 1920×1080, unit 30/30, build OK. Hall and car views were inspected with the car parked, passing and between floors.
- **Picture frames z-fighting (user report) — and a scanner bug:**
  - Cause: the photo plane sat exactly on the front face of its mat (both at wall + 18 mm).
  - The scanner had missed it: it intersected zero-thickness triangle bounding boxes, so two planes 1e-9 m apart never "overlapped". Boxes are now padded by the tolerance.
  - A buried-face filter was added: faces whose front side lies inside a collider (wall) are skipped.
  - Re-scan findings, now fixed:
    - frames rebuilt as frame (+1…31 mm), mat (+6…34 mm), photo (+37 mm)
    - the stair-door sign and the exit sign were placed at the same spot above every residential stair door; the exit sign now sits above it
    - the extinguisher sign had become flush with the new wainscot; it is now above the chair rail
    - the door newspaper slot was 0.5 mm off the leaf; now 3.5 mm
    - monitor screen and clock face were 1 mm off their bodies; now 4 mm
    - wainscot ends inset 3 mm from the baseboard ends
    - the unit-door threshold, accidentally dropped in the previous edit, was restored
  - Final scan (all floors, every anomaly, car at 10 heights): 49 overlaps in 7 groups, 0.16 m² total. All are hidden: faces above the lowered ceiling, a stair wall end, a chair base, the car door-leaf tops under the lintel.
  - Leak test: 0 rays hit the car.
  - Re-verified: unit 30/30, functional 34/34, secret playthrough 7/7, build OK. The gallery wall at a grazing angle and the stair-door signs were inspected.

## Not verified / remaining risks

- No full human playthrough at real speed; the 30–45 minute target is from the clock design (0.06 game-min/s while a call is open, fast-forward between calls), not measured.
- Only headless Chrome on one Windows machine/GPU. Firefox/Safari and other GPUs not tested. Pointer-lock mouse look cannot be exercised headless.
- Audio was verified through code paths (event counts, silence flag, sting counter), not by listening.
- Jumpscares: 3 forced stingers (ajar door slam, 13F arrival, bad ending) + 1 rate-limited (mirror) + the window-figure light cut; their subjective impact is untested.
- The image model behind Codex `image_gen` is unknown (tool does not report it).
- The JS bundle is a single 791 kB chunk (no code splitting).
