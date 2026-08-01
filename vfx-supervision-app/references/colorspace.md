# Colorspace & Color Management Reference

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [ACES Pipeline](#aces-pipeline)
3. [OCIO Configuration](#ocio-configuration)
4. [Camera Colorspaces](#camera-colorspaces)
5. [LUT Workflows](#lut-workflows)
6. [HDR Deliverables](#hdr-deliverables)
7. [CDL Workflow](#cdl-workflow)
8. [Common Pipeline Configurations](#common-pipeline-configurations)
9. [Troubleshooting](#troubleshooting)

---

## Core Concepts

**Scene-linear** — working colorspace where pixel values are proportional to scene luminance.
All physically-based compositing (light wraps, CG integration, lens effects) must happen
in scene-linear.

**Log** — perceptually encoded gamma curve used by cameras to capture wide dynamic range
in limited bit depth. Log footage must be linearized before mathematical compositing ops.

**Display-referred** — encoded for a specific display (Rec.709, P3, Rec.2020). Final stage only.

**Color gamut** — the range of colors a colorspace can represent. AP0 (ACES2065-1) is
the largest standard gamut, encompassing all visible colors.

**Encoding vs. Colorspace** — these are separate concepts. A file can have a gamut (e.g.,
S-Gamut3.Cine) and a transfer function (e.g., S-Log3) independently. Always specify both.

---

## ACES Pipeline

### ACES Versions
- **ACES 1.3** — current recommended version. Improved tonemap, supports HDR ODTs
- **ACES 1.0** — legacy, still widely deployed; avoid for new projects if possible
- **ACES 2.0** — emerging; new DRT (gamut compress-based), noticeably different look —
  confirm with DI facility before adopting

### Key Colorspaces
| Name | Usage | Encoding |
|------|-------|----------|
| ACES2065-1 (AP0) | Archive, interchange | Linear |
| ACEScg (AP1) | Compositing working space | Linear |
| ACEScc | Color correction (logarithmic feel) | Log-like |
| ACEScct | Color correction (toe, better shadow control) | Log-like |
| ACESproxy | On-set preview only | Log |

**Rule:** Deliver VFX plates to facilities in **ACEScg** or **ACES2065-1**. Never deliver
in ACEScc/ACEScct — those are grading spaces only.

### Input Transforms (IDT)
Each camera has a specific IDT (Input Device Transform) that converts camera-native log
to ACES2065-1. Source these from:
- **ARRI** — Official IDTs at arri.com/camera-system
- **RED** — Included in ACES OCIO configs
- **Sony** — Available from Sony Professional
- **CLF (Common LUT Format)** — ACES 1.3+ uses CLF for IDTs

### Output Transforms (ODT)
| Target | ODT Name |
|--------|----------|
| Rec.709 (broadcast/web) | Rec.709 (D60 sim) |
| P3-D65 (DCI, streaming) | P3-D65 |
| Rec.2020 PQ (HDR) | Rec.2020 ST2084 (1000 nits) |
| sRGB (web/review) | sRGB |

### RRT (Reference Rendering Transform)
The RRT converts ACEScg/ACES2065-1 to an output-referred image. In ACES 1.3 it's baked
into the Output Transform. In ACES 2.0 the DRT is significantly redesigned — blue hue
shift and highlight handling are notably different.

---

## OCIO Configuration

### OCIO v2 vs v1
- **Always use OCIO v2** for new projects. v2 adds: built-in transforms, display/view
  architecture, CLF support, per-view look chains.
- v1 configs are not forward-compatible with v2 — mixing versions breaks pipelines.

### Config Sources
- **ACES 1.3 OCIO config** — [github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES)
- **ARRI REVEAL config** — optimized for ARRI-centric pipelines
- **Studio-custom configs** — most larger facilities maintain their own

### Setting Up a Project OCIO Config
1. Choose a base config (ACES 1.3 recommended)
2. Add any additional camera colorspaces not in the base
3. Set the `default` role to `scene_linear` (maps to `ACEScg`)
4. Define display/view pairs for each monitor type on the project
5. Add project-specific looks (dailies LUTs, show LUT)
6. Version-lock the config and store in the project root; share via env var `OCIO=/path/to/config.ocio`

### OCIO Roles (Critical)
```yaml
roles:
  scene_linear: ACEScg
  rendering: ACEScg
  compositing_linear: ACEScg
  color_picking: ACEScg
  data: Raw
  default: ACEScg
  reference: ACES2065-1
  texture_paint: ACEScg
  matte_paint: ACEScg
  color_timing: ACEScct
```

### Common OCIO Integration Points
- **Nuke** — set via `OCIO` env var or project settings; use OCIOColorSpace node
- **Houdini** — set via `OCIO` env var; native OCIO support in Karma/Mantra
- **Maya** — Color Management preferences; set config path
- **Resolve** — OCIO color science mode; import config directly
- **Blender** — Sequencer / compositor OCIO support via env var

---

## Camera Colorspaces

| Camera | Log Encoding | Gamut | Notes |
|--------|-------------|-------|-------|
| ARRI ALEXA 35 | LogC4 | AWG4 | New encoding — not backward compatible with LogC3 IDTs |
| ARRI ALEXA Mini LF / LF | LogC3 | AWG3 | Most common ARRI on current projects |
| ARRI ALEXA Classic/XT | LogC3 EI-dependent | AWG3 | EI setting affects IDT |
| RED MONSTRO/HELIUM/GEMINI | IPP2 (REDWideGamutRGB) | REDWideGamutRGB | Avoid Legacy mode; use IPP2 only |
| RED V-RAPTOR / KOMODO X | IPP2 | REDWideGamutRGB | Same as above |
| Sony VENICE / VENICE 2 | S-Log3 | S-Gamut3.Cine | S-Gamut3.Cine preferred over S-Gamut3 for most work |
| Sony FX9 / FX6 / BURANO | S-Log3 | S-Gamut3.Cine | |
| Blackmagic URSA Cine | Blackmagic Film Gen 5 | Blackmagic Wide Gamut Gen 5 | Gen 5 for URSA Cine; older cameras use Gen 4 |
| Canon C70 / C300 III / C700 | Canon Log 2 or Log 3 | Cinema Gamut | Log 2 = wider, lower noise; Log 3 = more S-curve |
| DJI Inspire 3 / Zenmuse X9 | D-Log M | DJI Cinema Color System | D-Log M replaces D-Log for new DJI cameras |
| Panasonic LUMIX BS1H | V-Log | V-Gamut | Less common in VFX productions |

**Key Watch-Out:** LogC3 and LogC4 are NOT interchangeable. Applying a LogC3 IDT to
LogC4 footage (ALEXA 35) will produce incorrect results. Always confirm camera model
before setting IDTs.

---

## LUT Workflows

### 1D vs 3D LUTs
- **1D LUT** — per-channel only (R, G, B independently); applies tone curves, no
  cross-channel color shifts. Fast. Used for gamma conversion, view transforms.
- **3D LUT** — maps any input RGB triplet to any output. Handles cross-channel ops,
  saturation, hue rotation. Used for creative grades, camera-to-display transforms.

### LUT Formats
| Format | Type | Notes |
|--------|------|-------|
| .cube | 1D or 3D | Most universal; used in Resolve, Nuke, AE, Livegrade |
| .csp | 3D | Older Autodesk format; still seen in some pipelines |
| .clf | 1D/3D/matrix | ACES standard; preferred for OCIO v2 |
| .3dl | 3D | Lustre/Flame native |
| .lut | Various | Ambiguous extension — confirm format before use |

### LUT Resolution
- **33³ (33x33x33)** — standard for most creative grades; good balance
- **65³** — smoother gradations; use for complex transforms
- **17³** — real-time preview only; not for final renders

### Show LUT Structure (Recommended)
```
Input (camera log) → IDT → ACEScg (scene linear) 
→ RRT → ODT → Display
```
Separate these transforms. Never bake IDT + creative grade + ODT into a single LUT
for VFX plates — it prevents any future re-grade.

### LUT Management
- Store LUTs in a versioned project directory: `/project/luts/v001/`
- Name convention: `SHOW_CAMERA_PURPOSE_VERSION.cube`
  (e.g., `PROJ_ALEXA35_DailiesRec709_v003.cube`)
- Never overwrite a LUT version — always increment

---

## HDR Deliverables

### HDR Standards
| Standard | Transfer Function | Peak Luminance | Gamut |
|----------|------------------|---------------|-------|
| HDR10 | PQ (ST 2084) | 1000 nits (metadata) | Rec.2020 |
| HDR10+ | PQ (dynamic metadata) | Up to 4000 nits | Rec.2020 |
| Dolby Vision | PQ (proprietary metadata) | Up to 10,000 nits | Rec.2020 |
| HLG | HLG (ST 2100) | ~1000 nits | Rec.2020 |
| P3-D65 PQ | PQ | 1000 nits | DCI P3 |

### Dual-Delivery Strategy (HDR + SDR)
1. **Grade in HDR first** (Rec.2020 PQ, 1000 nits reference monitor)
2. **Trim pass for SDR** — don't simply convert; the HDR grade won't translate directly
3. VFX should deliver **HDR-capable plates** — if shot on LOG with wide dynamic range,
   preserve it; don't clip highlights in transcode
4. Confirm **nit targets** with the facility at project start (some streamers specify 600,
   800, or 1000 nit mastering)

### VFX Implications for HDR
- CG renders must be in **scene-linear with no clamping** — let the DRT handle mapping
- Lens flares, blooms, and practical light sources should exceed 1.0 in linear —
  HDR can display them; SDR will tone-map them
- Check that **reference monitors on set and in comp** are HDR-calibrated if delivering HDR

---

## CDL Workflow

**CDL (Color Decision List)** — a simple, device-independent color correction format.
Contains only: Slope, Offset, Power (per-channel) + Saturation.

### CDL in Production
- **On-set**: DIT applies CDLs in Livegrade/Silverstack for dailies look
- **Dailies**: CDLs travel with footage as sidecar `.cdl`, `.ccc`, or `.edl`-embedded
- **VFX**: CDLs are applied in comp as reference for matching the intended grade
- **DI**: CDLs are the starting point for the colorist's grade

### CDL Limitations
- Cannot represent complex grades (hue rotation, selective correction)
- No spatial operations (vignettes, windows)
- Use as a **starting point**, not a final grade replacement

### CDL File Formats
- `.cdl` — single CDL
- `.ccc` — multiple CDLs (Color Correction Collection), indexed by clip ID
- `.ale` — Avid Log Exchange, embeds CDL per clip

---

## Common Pipeline Configurations

### Typical Feature Film Pipeline
```
Camera (LogC4/S-Log3) → On-set CDL (Livegrade) 
→ DIT transcode (ProRes 4444, baked dailies LUT) 
→ Offline edit (DNxHD/ProRes LT) 
→ VFX pull (RAW or EXR, linear/ACEScg) 
→ Composite in ACEScg 
→ VFX final (EXR, ACEScg) 
→ DI conform → Grade in ACEScct → HDR/SDR ODT → Delivery
```

### Typical Episodic (Streaming) Pipeline
- Often ACES 1.3-based but studio-specific variations are common
- HDR10 primary + SDR Rec.709 trim
- Tighter turnaround = more automation in dailies and transcode pipeline
- VFX finals often need to be both HDR and SDR reviewed

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| CG looks too saturated vs. plate | Working in sRGB not scene-linear | Switch compositing to ACEScg scene-linear |
| Wrong IDT applied to camera | LogC3 used on ALEXA 35 (LogC4) | Match IDT to exact camera model |
| Plates look washed out in Nuke | Read node colorspace set to Raw | Set Read node to correct camera log colorspace |
| LUT looks different in different apps | App-specific LUT interpretation differences | Use CLF format via OCIO for consistent results |
| HDR review looks clipped vs. SDR | Monitor not calibrated for HDR / ODT mismatch | Confirm correct ODT for display type |
| Colors shift in comp vs. grade | Different OCIO configs in use | Lock config version, distribute via `OCIO` env var |
