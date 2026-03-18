---
name: vfx-supervisor
description: >
  Comprehensive VFX Supervisor reference covering the full production pipeline.
  Use this skill whenever the user asks about ANY of the following: colorspace workflows,
  ACES, OCIO, LUTs, color correction, on-set VFX supervision, greenscreen/LED volume,
  HDRI capture, matchmove, camera tracking, lens distortion, STmaps, pre-production VFX
  breakdowns and bidding, post-production budgeting, DIT services, dailies workflows,
  Nuke compositing, After Effects compositing, editorial turnovers and deliveries, codecs
  (EXR, ProRes, ARRIRAW, BRAW, etc.), CGI/3D pipeline, Houdini FX, AOV compositing,
  ComfyUI and AI-assisted VFX, camera and lens technical specs (ARRI, RED, Sony, Blackmagic),
  or any topic related to VFX production from script breakdown through final delivery.
  Trigger even for partial matches — e.g. "what LogC should I use", "how do I set up
  greenscreen lighting", "what handles should I give vendors", "how do I undistort plates".
---

# VFX Supervisor Skill

This skill provides expert-level guidance across the entire VFX pipeline — from script
breakdown through final delivery. It is organized into 13 domain reference files. Always
read the relevant reference file before responding. For multi-domain questions, read all
applicable files.

---

## Domain Map — Which File to Read

| Domain | Reference File | Key Topics |
|--------|---------------|------------|
| Colorspace & Color Management | `references/colorspace.md` | ACES, OCIO, LUTs, camera colorspaces, HDR/SDR delivery |
| Pre-Production | `references/pre-production.md` | Script breakdown, VFX bid, tech scouts, previs, vendor selection |
| On-Set Supervision | `references/onset-supervision.md` | HDRI, photogrammetry, greenscreen, LED volume, tracking markers, surveying |
| Post-Production Budgeting | `references/post-budgeting.md` | Cost estimation, vendor contracts, change orders, burn tracking |
| DIT Services & Workflow | `references/dit-workflow.md` | Data offload, Livegrade, dailies, metadata, archiving |
| Editorial & Deliveries | `references/editorial-deliveries.md` | VFX turnovers, handles, EDL/AAF/XML, naming conventions, finals delivery |
| Codecs & File Formats | `references/codecs.md` | RAW, intermediate, delivery, EXR, DPX, bit depth, frame rates |
| Nuke Workflows | `references/nuke-workflow.md` | Node graph, AOV comping, keying, 3D, Python, render farm |
| After Effects Workflows | `references/after-effects-workflow.md` | Layer comping, OCIO in AE, expressions, plugins, Media Encoder |
| ComfyUI / AI-Assisted VFX | `references/comfyui-workflow.md` | SD, ControlNet, inpainting, AI roto, upscaling, pipeline integration |
| CGI / 3D Pipeline | `references/cgi-pipeline.md` | USD, AOVs, Houdini FX, Maya, rendering, lighting reference, textures |
| Camera Tracking & Matchmove | `references/camera-tracking.md` | 3DEqualizer, PFTrack, SynthEyes, lidar solves, QC, delivery formats |
| Lens Distortion | `references/lens-distortion.md` | Grid calibration, STmaps, undistort/redistort, anamorphic, 3DE models |
| Camera & Lens Reference | `references/camera-lens-reference.md` | ARRI, RED, Sony, Blackmagic, Canon, DJI specs, sensor sizes, anamorphic |

---

## Response Guidelines

- **Be specific and technical.** This skill is for working VFX professionals — use correct
  industry terminology without over-explaining basics unless asked.
- **Lead with the practical answer**, then provide context or caveats.
- **When referencing settings, specs, or values** — be precise (e.g., don't say "use a
  high bit depth EXR", say "use 16-bit half-float EXR").
- **Call out pipeline dependencies.** Many VFX decisions affect upstream and downstream
  steps — flag these where relevant.
- **When multiple valid approaches exist**, present them with tradeoffs rather than a single
  answer. Note industry-standard approaches vs. studio-specific variants.
- **For on-set questions**, prioritize data capture completeness and error prevention over
  speed.
- **For budgeting/bidding questions**, provide frameworks and typical ranges rather than
  fixed numbers, since markets vary.

---

## Quick Reference — Most Common Queries

### Colorspace
- ARRI ALEXA 35 → **LogC4 / AWG4** (not LogC3 — that's ALEXA Mini LF and older)
- RED → **IPP2 / REDWideGamutRGB**
- Sony VENICE 2 → **S-Log3 / S-Gamut3.Cine**
- ACES interchange format → **ACES2065-1 (AP0)**; working space → **ACEScg (AP1)**
- OCIO v2 is current standard; avoid OCIO v1 for new projects

### Codecs
- VFX plates → **EXR 16-bit half-float, ZIP or ZIPS compression**
- Dailies → **ProRes 4444 or DNxHR HQX** (with LUT baked or sidecar)
- Camera RAW archival → always keep **original RAW** before any transcode

### On-Set
- HDRI brackets → **±3EV in 2-stop increments, minimum 7 exposures**, 360° on chrome ball + grey ball
- Tracking markers → **black/white targets on matte surface**, min. **10cm at 10m distance**, 40–60 per major surface
- Clean plate → shoot **before and after** principal photography, match lighting conditions

### Nuke
- Always set **project settings colorspace to scene-linear (ACEScg or linear)**
- Use **Read node colorspace override** to handle input transforms; never bake into the file
- EXR multi-layer: use **Shuffle** node to extract AOVs, never Merge without understanding the pass

### Turnovers
- Standard handle length: **8–16 frames** head and tail (confirm with facility)
- VFX pull list must include: **cut in, cut out, handle in, handle out, scene/shot/take, reel**

---

## When Multiple Domains Apply

Some questions span multiple references. Examples:

- *"How do I set up an ACES pipeline for Nuke with ARRI footage?"*
  → Read `colorspace.md` + `nuke-workflow.md` + `camera-lens-reference.md`

- *"What do I need to capture on set for a CG environment replacement?"*
  → Read `onset-supervision.md` + `cgi-pipeline.md` + `camera-tracking.md`

- *"How do I deliver VFX finals to editorial?"*
  → Read `editorial-deliveries.md` + `codecs.md`

- *"What should I put in a VFX bid?"*
  → Read `pre-production.md` + `post-budgeting.md`
