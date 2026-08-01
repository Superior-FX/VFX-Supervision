# Camera & Lens Reference

## Table of Contents
1. [ARRI Cameras](#arri-cameras)
2. [RED Cameras](#red-cameras)
3. [Sony Cameras](#sony-cameras)
4. [Blackmagic Cameras](#blackmagic-cameras)
5. [Canon Cinema Cameras](#canon-cinema-cameras)
6. [DJI Aerial Cameras](#dji-aerial-cameras)
7. [Sensor Size Reference](#sensor-size-reference)
8. [Anamorphic Lens Families](#anamorphic-lens-families)
9. [Spherical Prime & Zoom Families](#spherical-prime--zoom-families)
10. [Frame Rate, Shutter & Motion Blur for VFX](#frame-rate-shutter--motion-blur-for-vfx)
11. [T-Stop vs. F-Stop for CG Lighting](#t-stop-vs-f-stop-for-cg-lighting)
12. [VFX Implications by Camera/Sensor Choice](#vfx-implications-by-camerasensor-choice)

---

## ARRI Cameras

### ARRI ALEXA 35
| Parameter | Value |
|-----------|-------|
| Sensor | 4.6K Custom CMOS (35.85 × 25.54mm) |
| Max resolution | 4.6K (4608 × 3164 native; 4K/3.8K cropped modes) |
| Log encoding | **LogC4** (new — not compatible with LogC3 LUTs) |
| Color gamut | **AWG4** (ARRI Wide Gamut 4) |
| Dynamic range | ~17 stops |
| RAW format | ARRIRAW (.ari / .mxf) |
| Codecs | ARRIRAW, Apple ProRes (in-camera) |
| Dual base ISO | 800 / 3200 |
| VFX notes | New LogC4 IDT required; AWG4 wider than previous ARRI gamuts; excellent greenscreen latitude |

### ARRI ALEXA Mini LF
| Parameter | Value |
|-----------|-------|
| Sensor | LF (Large Format) — 36.70 × 25.54mm |
| Max resolution | 4.5K (4448 × 3096) |
| Log encoding | **LogC3** |
| Color gamut | **AWG3** |
| Dynamic range | ~14.5 stops |
| RAW format | ARRIRAW |
| VFX notes | Most common ARRI on feature films; pairs well with LF lens set; LogC3 IDTs widely available |

### ARRI ALEXA LF
| Parameter | Value |
|-----------|-------|
| Sensor | LF — 36.70 × 25.54mm |
| Max resolution | 4.5K |
| Log encoding | LogC3 |
| Color gamut | AWG3 |
| Notes | Older LF body; same color science as Mini LF |

### ARRI ALEXA Mini
| Parameter | Value |
|-----------|-------|
| Sensor | Super 35 — 28.17 × 18.13mm |
| Max resolution | 3.2K (3200 × 1800) |
| Log encoding | LogC3 |
| Color gamut | AWG3 |
| VFX notes | Still popular for handheld and gimbal; smaller S35 frame vs LF |

### LogC3 vs LogC4 — Critical
⚠️ **Do not apply LogC3 IDTs to ALEXA 35 (LogC4) footage.** The encodings are completely
different. The ALEXA 35 requires LogC4 IDTs. Applying the wrong IDT produces incorrect
color science and will fail QC.

---

## RED Cameras

### RED V-RAPTOR [X] 8K VV
| Parameter | Value |
|-----------|-------|
| Sensor | Vista Vision — 40.96 × 21.60mm |
| Max resolution | 8K (8192 × 4320) |
| Log encoding | Log3G10 (REDWideGamutRGB via IPP2) |
| Color gamut | REDWideGamutRGB |
| RAW format | R3D |
| Compression | 3:1 to 22:1 |
| VFX notes | Large VV sensor; excellent for S35 or VV workflow; IPP2 only for VFX |

### RED KOMODO-X 6K
| Parameter | Value |
|-----------|-------|
| Sensor | Super 35 — 27.03 × 14.24mm |
| Max resolution | 6K (6144 × 3240) |
| Log encoding | Log3G10 / IPP2 |
| Color gamut | REDWideGamutRGB |
| VFX notes | Compact; global shutter on KOMODO-X (eliminates rolling shutter artifacts for VFX) |

### RED Workflow Notes
- **Always use IPP2** — Legacy color science is deprecated; IDTs in ACES only for IPP2
- R3D metadata embeds focal length, ISO, WB — pass to matchmove team
- RED clips can be delivered as R3D (RAW) or as transcoded ProRes/DNxHR
- Compression artifacts are more visible at high compression ratios (> 8:1) — check before VFX work

---

## Sony Cameras

### Sony VENICE 2
| Parameter | Value |
|-----------|-------|
| Sensor | Full Frame (35.9 × 24.0mm) / 6K options |
| Max resolution | 8.6K (full frame), 6K (cropped), 4K |
| Log encoding | **S-Log3** |
| Color gamut | **S-Gamut3.Cine** (recommended) or S-Gamut3 |
| RAW format | X-OCN (XT, ST, LT) in MXF |
| Dual base ISO | 800 / 3200 |
| VFX notes | Large full-frame sensor; great skin tones; S-Gamut3.Cine preferred for VFX (closer to Rec.709 for easier grading) |

### Sony BURANO
| Parameter | Value |
|-----------|-------|
| Sensor | Full Frame — 35.9 × 24.0mm |
| Max resolution | 8K |
| Log encoding | S-Log3 |
| Color gamut | S-Gamut3.Cine |
| Notes | Compact full-frame; built-in IBIS; growing adoption for episodic |

### Sony FX9 / FX6
| Parameter | Value |
|-----------|-------|
| Sensor | Full Frame (FX9) / Full Frame (FX6) |
| Max resolution | 6K (FX9) / 4K (FX6) |
| Log encoding | S-Log3 |
| Color gamut | S-Gamut3.Cine |
| VFX notes | Lower-budget productions; same color science as VENICE; solid for VFX work |

### S-Gamut3 vs S-Gamut3.Cine
- **S-Gamut3**: larger gamut; can contain colors outside human perception — more complex to handle
- **S-Gamut3.Cine**: smaller, more practical gamut; closer to DCI P3; preferred for VFX pipelines
- Use S-Gamut3.Cine unless there's a specific reason for S-Gamut3

---

## Blackmagic Cameras

### Blackmagic URSA Cine 17K
| Parameter | Value |
|-----------|-------|
| Sensor | 65mm Format — 56.5 × 31.8mm |
| Max resolution | 17.4K (17,280 × 9,720) |
| Log encoding | Blackmagic Film Gen 5 |
| Color gamut | Blackmagic Wide Gamut Gen 5 |
| RAW format | BRAW (Blackmagic RAW) |
| VFX notes | Large format 65mm equivalent; newer camera (2024); Gen 5 color science |

### Blackmagic URSA Mini Pro 12K
| Parameter | Value |
|-----------|-------|
| Sensor | Super 35 — 27.03 × 14.25mm |
| Max resolution | 12K (12,288 × 6,480) |
| Log encoding | Blackmagic Film Gen 5 |
| Color gamut | Blackmagic Wide Gamut Gen 5 |
| RAW format | BRAW |
| VFX notes | Cost-effective high-resolution; BRAW decodes natively in Resolve |

### Blackmagic Pocket Cinema 6K G2
| Parameter | Value |
|-----------|-------|
| Sensor | Super 35 — 23.1 × 12.99mm |
| Log encoding | Blackmagic Film Gen 4 or Gen 5 |
| Notes | Popular for indie/lower budget; same BRAW format |

### Blackmagic Color Science Generations
- **Gen 4**: older Pocket cameras, older URSA Mini models
- **Gen 5**: URSA Mini Pro 12K, URSA Cine — new IDTs required; don't mix with Gen 4 IDTs

---

## Canon Cinema Cameras

### Canon EOS C70
| Parameter | Value |
|-----------|-------|
| Sensor | Super 35 (digital cinema crop) |
| Max resolution | 4K |
| Log encoding | **Canon Log 2** (recommended) or Canon Log 3 |
| Color gamut | Cinema Gamut |
| VFX notes | Compact; Cinema RAW Light internal recording; good value for VFX work |

### Canon EOS C300 Mark III
| Parameter | Value |
|-----------|-------|
| Sensor | Super 35 — dual gain |
| Max resolution | 4K |
| Log encoding | Canon Log 2 / Canon Log 3 |
| Color gamut | Cinema Gamut |
| Notes | Cinema RAW Light or XF-AVC |

### Canon Log 2 vs Canon Log 3
- **Canon Log 2**: wider dynamic range encoding; more latitude; recommended for VFX
- **Canon Log 3**: more contrast in midtones; more like traditional log curves
- Different IDTs — confirm which log setting was used on set

---

## DJI Aerial Cameras

### DJI Inspire 3 / Zenmuse X9
| Parameter | Value |
|-----------|-------|
| Sensor | Full Frame (X9-8K Air) or Super 35 |
| Max resolution | 8K |
| Log encoding | **D-Log M** |
| Color gamut | DJI Cinema Color System (DCCS) |
| RAW format | CinemaDNG or .insraw |
| VFX notes | Primary drone camera for premium productions; D-Log M has good dynamic range for VFX |

### DJI Ronin 4D
| Parameter | Value |
|-----------|-------|
| Sensor | Full Frame |
| Max resolution | 6K |
| Log encoding | D-Log M |
| Color gamut | DCCS |
| Notes | All-in-one cinema rig with gimbal; 6K Zenmuse X9 sensor |

### DJI Mavic 3 Cine
| Parameter | Value |
|-----------|-------|
| Sensor | 4/3" CMOS |
| Max resolution | 5.1K |
| Log encoding | D-Log M |
| VFX notes | Compact; lower dynamic range than larger sensors; suitable for background plates and atmosphere |

### DJI D-Log vs D-Log M
- **D-Log**: older encoding; less dynamic range
- **D-Log M**: current standard for DJI cameras (2022+); wider dynamic range; use D-Log M IDTs

---

## Sensor Size Reference

| Format | Sensor Dimensions (approx.) | Cameras | Crop vs FF |
|--------|---------------------------|---------|-----------|
| 65mm / VistaVision | 56.5 × 31.8mm (URSA Cine) / 40.96 × 21.6mm (V-RAPTOR VV) | URSA Cine 17K, RED V-RAPTOR VV | 1.6× larger than FF |
| Full Frame (FF) | 35.9 × 24.0mm | VENICE 2, BURANO, ALEXA LF | 1× (reference) |
| Large Format (ARRI LF) | 36.70 × 25.54mm | ALEXA LF, Mini LF, ALEXA 35 | ~1× (slightly wider than FF) |
| Super 35 (S35) | 24–28mm wide (varies) | ALEXA Mini, most REDs, C300 | ~1.5× crop vs FF |
| APS-C | 23.5 × 15.6mm | FX30, some Canon | ~1.5× crop |
| 4/3" | 17.3 × 13.0mm | DJI Mavic 3, GH6 | ~2× crop |
| 1" | 13.2 × 8.8mm | Sony RX0, some drone cameras | ~2.7× crop |

**VFX Implications of Sensor Size:**
- Larger sensor = shallower depth of field at same aperture → CG matching requires accurate DOF
- Larger sensor = wider field of view at same focal length (longer lens needed to match same FOV as S35)
- Depth of field directly affects how soft backgrounds appear — must match in CG

---

## Anamorphic Lens Families

### 2× Anamorphic Primes
| Lens Family | Manufacturer | Notes |
|------------|-------------|-------|
| Hawk V-Series | Vantage | Very popular; oval bokeh; slightly warm color |
| Cooke Anamorphic/i | Cooke | Modern design; precise metadata (i/Technology); sharp |
| Master Anamorphic | ARRI/Zeiss | High speed; large elements |
| Panavision C, E, G Series | Panavision | Classic anamorphic; rental-only |
| Leica Thalia Anamorphic | Leica | German optics; very clean rendering |
| Sigma Cine Anamorphic Art | Sigma | Cost-effective; accessible |

### 1.33× Anamorphic
| Lens Family | Notes |
|------------|-------|
| Atlas Orion | S35 anamorphic; popular for mirrorless cameras |
| DZO Octavia | Budget-friendly; growing adoption |
| Laowa Nanomorph | Ultra-compact anamorphic adapters |

### Anamorphic VFX Considerations
- **Oval bokeh**: out-of-focus CG must use anamorphic lens shader to match
- **Horizontal flare**: lens flares are horizontal/streak in anamorphic — CG flares must match
- **Distortion**: see Lens Distortion reference for anamorphic model
- **Desqueeze**: all work must be done in desqueezed space
- **Field of view**: 2× lens on S35 shoots ~2.39:1; 1.33× on 4:3 sensor shoots ~16:9

---

## Spherical Prime & Zoom Families

### Common Spherical Primes (Feature Film)
| Family | Notes |
|--------|-------|
| Zeiss Master Primes | Industry standard; clean, sharp |
| ARRI/Zeiss Ultra Primes | Fast, compact; staple of VFX productions |
| Cooke S4/i, S7/i | "Cooke Look" — slightly warm, flattering skin |
| Leica Summilux-C | Premium; very low distortion; VFX-friendly |
| Panavision Primos | Panavision rental; classic Hollywood look |
| Sigma Cine FF Art | Cost-effective; sharp; modern distortion characteristics |

### Common Zooms
| Lens | Range | Notes |
|------|-------|-------|
| ARRI/Zeiss Master Zoom | 16.5–110mm | Professional; parfocal; consistent distortion |
| Angénieux EZ/Type EF | 22–60mm / 45–135mm | Modular system; common on episodic |
| Cooke Varotal/i | Various | Parfocal; Cooke look on zooms |

### VFX Considerations for Zoom Lenses
- Distortion **changes with focal length** — must calibrate at multiple focal lengths
- Breathing (focus shift with zoom) complicates matchmove
- Confirm whether the zoom was used at a **fixed focal length** or truly zoomed during shot

---

## Frame Rate, Shutter & Motion Blur for VFX

### Shutter Angle and Motion Blur
Standard shutter angle = **180°** (exposure = 1/(FPS × 2))

| Frame Rate | Shutter (180°) | Exposure |
|-----------|---------------|---------|
| 24 fps | 172.8° (1/48s) | Normal |
| 25 fps | 180° (1/50s) | Normal |
| 29.97 fps | 180° (1/60s) | Normal |
| 48 fps | 180° (1/96s) | HFR |
| 120 fps | 180° (1/240s) | Slow-mo |

**For CG Motion Blur:**
- CG renders must match the **actual shutter angle used in the plate**
- 180° shutter = render with shutter fraction of 0.5
- If the camera used a non-standard shutter (e.g., 90° for stunt work), adjust CG shutter accordingly
- Confirm from camera report — do not assume 180°

### Overcrank (High-Speed) Workflow
- Camera shoots at 120fps; editorial plays at 24fps = **5× slow motion**
- Plates have very short exposure = less motion blur
- CG for overcranked shots needs to account for the **increased frame rate in rendering**
  or use very short shutter fractions
- Confirm the editorial playback speed to understand the actual shutter angle equivalent

---

## T-Stop vs. F-Stop for CG Lighting

| Term | Definition | Usage |
|------|-----------|-------|
| **F-stop** | Geometric ratio of focal length to aperture diameter | Optical formula; consistent across lenses |
| **T-stop** | Measured transmission through the lens | Actual light transmission; accounts for glass losses |

**Why T-stop matters for VFX:**
- T-stops are **calibrated to actual light transmission** — different lenses at T2.0 pass
  the same amount of light
- When matching CG to plate exposure, use **T-stop** (from camera report) not f-stop
- F2.0 and T2.0 are not the same — T2.0 will be slightly less bright than F2.0 due to glass absorption
- For CG rendering: use T-stop to set the virtual aperture value for physically accurate matching

### Exposure Matching Workflow
1. Read camera report: ISO, T-stop, shutter angle, frame rate
2. In CG renderer: set camera to same T-stop and shutter angle
3. Use **grey ball HDRI** or an 18% grey card in the comp to verify CG brightness matches
4. If using EXR linear values: the grey ball HDRI middle grey should match between plate and CG render

---

## VFX Implications by Camera/Sensor Choice

| Camera Choice | VFX Implication |
|--------------|----------------|
| ARRI ALEXA 35 (LogC4) | Ensure correct LogC4 IDTs; AWG4 is a wider gamut |
| Large format (ARRI LF, VENICE 2 FF) | Shallower DOF; more lens distortion at edges; heavier matchmove computation |
| Anamorphic lenses | Requires desqueeze in all VFX work; anamorphic lens model for distortion; oval bokeh in CG |
| High frame rate (96/120fps) | More frames to comp; shorter shutter = less motion blur in plates; CG must match |
| Small sensor (DJI, 4/3") | More DOF (everything in focus); simpler CG DOF matching; more noise at high ISO |
| Zoom lens | Distortion changes by focal length; track if focal length changes during shot |
| Rolling shutter cameras | CG won't have rolling shutter artifacts; may be visible mismatch; consider de-RS |
