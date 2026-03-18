# Lens Distortion Reference

## Table of Contents
1. [Lens Distortion Fundamentals](#lens-distortion-fundamentals)
2. [Types of Lens Distortion](#types-of-lens-distortion)
3. [Lens Grid Calibration](#lens-grid-calibration)
4. [STMap Generation](#stmap-generation)
5. [Undistort / Work / Redistort Pipeline](#undistort--work--redistort-pipeline)
6. [Anamorphic Desqueeze & Distortion](#anamorphic-desqueeze--distortion)
7. [3DE Lens Models](#3de-lens-models)
8. [Witness Camera Lens Calibration](#witness-camera-lens-calibration)
9. [Practical Workflow Checklist](#practical-workflow-checklist)

---

## Lens Distortion Fundamentals

All camera lenses introduce some degree of geometric distortion — they do not project
the world linearly onto the sensor. This means that straight lines in the real world
appear curved in the image.

**Why it matters for VFX:**
- CG elements rendered with a pinhole (perfect) camera will not align with the distorted plate
- Matchmove solves must account for lens distortion to be accurate
- Composited elements that don't account for distortion will appear to drift at frame edges

**The core pipeline:**
```
Distorted plate → Undistort → Work in linear space → Redistort → Output
```

All compositing, CG alignment, and rendering should happen on **undistorted** (linearized)
plates. Distortion is re-applied as the final step before delivery.

---

## Types of Lens Distortion

### Radial Distortion
Distortion that varies with distance from the optical center.

| Type | Description | Typical Cause |
|------|-------------|--------------|
| **Barrel distortion** | Lines bow outward; center magnified | Wide-angle, wide-zoom lenses |
| **Pincushion distortion** | Lines bow inward; corners magnified | Telephoto lenses |
| **Mustache / Wave** | Mixed barrel at center + pincushion at edges | Common in modern aspherical lenses, zooms |

### Decentering Distortion (Tangential)
- Caused by lens elements not being perfectly centered on the optical axis
- Creates an asymmetric shift/tilt in the distortion pattern
- Requires more complex lens models to capture

### Anamorphic Distortion
- Anamorphic lenses have **different distortion characteristics** horizontally vs. vertically
- Horizontal: typically barrel distortion (wider coverage)
- Vertical: often much less distortion or slight pincushion
- Cannot be modeled with a simple radial model — requires an anamorphic-specific model

---

## Lens Grid Calibration

### Purpose
Lens calibration generates an accurate mathematical model of the lens distortion from
a physical capture — a checkerboard or grid pattern.

### Calibration Target Types
| Target | Notes |
|--------|-------|
| **Checkerboard** | Standard for most calibration; high-contrast corners are easy to detect |
| **Dot grid** | Used in 3DEqualizer; very accurate; tight dot spacing preferred |
| **Lens Grid Chart** | Specialized grid chart with known geometry; often used for anamorphic |

### Shooting the Calibration
1. Use the **exact lens, exact camera body, exact focus distance** used in production
   (or a representative focus distance if focus pulls are significant)
2. Light the target evenly — no shadows, no glare
3. Fill the frame with the grid target — the entire frame, edge to edge
4. Shoot **multiple frames** at the same settings (take the best-quality frame)
5. For zooms: calibrate at **multiple focal lengths** (every 5–10mm across the range)
6. For lenses with breathing (focus shift): calibrate at multiple focus distances
7. **Do not apply any in-camera processing** (sharpening, noise reduction) — shoot RAW

### Calibration in 3DEqualizer
1. `Lens → Lens Calibration` (3DE4 workflow)
2. Import calibration image(s)
3. Define the grid: dot count horizontal and vertical, dot spacing in mm
4. Run auto-detection; manually verify dots are correctly detected
5. Solve lens model: choose model type (see 3DE Lens Models section)
6. Check residuals: < 0.2 pixels is excellent
7. Export: STMap, or apply directly to project as the distortion model

### Calibration in PFBarrel / Other Tools
- **PFBarrel** (standalone, free): simple lens calibration from grid
- **OpenCV / Python**: for custom pipelines; can generate accurate models from checkerboard
- **Capture One / PTLens**: photo-oriented; less accurate than dedicated VFX tools

---

## STMap Generation

**STMap (UV Map / Warp Map)** — a 2D texture where each pixel's RGB value encodes where
that pixel should sample from in the source image (XY coordinates stored as R and G channels).

- **Undistort STMap**: maps from distorted space → undistorted space (straightens the image)
- **Redistort STMap**: maps from undistorted space → distorted space (re-applies distortion)

### Why Use STMaps
- Store the distortion model as a single image file — no need for lens parameters in comp
- Can be applied in Nuke, AE, Flame, Resolve, or any tool that supports STMap/UV warp
- Faster at render time than calculating the distortion model on every frame

### Generating STMaps in 3DE
```
3DE: Lens → Export → Distortion → STMap

Settings:
  - Resolution: match plate resolution exactly (e.g., 4096×2160)
  - Channels: R = X displacement, G = Y displacement
  - Export: Undistort STMap + Redistort STMap (both needed)
  - Format: EXR 32-bit float (must be floating point for sub-pixel accuracy)
  - Normalization: 0–1 (maps full frame; 0.5 = center)
```

### STMap Format
| Channel | Encodes |
|---------|---------|
| R | X coordinate (0.0 = left edge, 1.0 = right edge) |
| G | Y coordinate (0.0 = bottom, 1.0 = top) — note: Y may be inverted depending on tool |
| B | Unused (typically 0) |

⚠️ **Y-axis convention varies**: Nuke's STMap node uses Y=0 at bottom; some tools use
Y=0 at top. Confirm which convention your STMap was generated for.

### STMap Resolution
- Must exactly match the plate resolution
- For 2K proxy workflow: generate separate STMaps for proxy and full-res
- A 4K STMap on a 2K plate will still work (just wasteful — the sampling is still correct)

---

## Undistort / Work / Redistort Pipeline

### The Three Stages

```
Stage 1: UNDISTORT
  Distorted plate → STMapUndistort → Undistorted (linear) plate
  
Stage 2: WORK
  All compositing happens here in undistorted space
  CG renders are generated with no distortion (pinhole camera)
  Matchmove camera is a perfect pinhole camera solve
  
Stage 3: REDISTORT
  Finished comp → STMapRedistort → Redistorted final (matches original plate geometry)
```

### Nuke Implementation

```nuke
# Stage 1: Undistort the plate
Read [plate] → STMap [undistort_stmap] → Viewer

# Stage 2: All comp work in undistorted space
[undistorted plate] + [CG renders] → [full composite]

# Stage 3: Redistort for output
[composite] → STMap [redistort_stmap] → Write [output]
```

**Nuke STMap node setup:**
- `STMap.channels` → RGB (maps from STMap channels to warp UV)
- `STMap.uv` → set to the correct channels from the stmap (usually "rgb")
- Ensure the plate being warped and the STMap are the same resolution

### Overscan Considerations
Undistortion can expand the image beyond the original frame edges (barrel distortion
pushes content outward when corrected). To handle this:
- Use **overscan** — render CG with wider field of view so content fills the expanded frame
- Common overscan: **5–10%** additional border around the frame
- In Nuke: increase format slightly beyond plate size for the undistorted working space
- Redistort will bring the content back to the original frame boundary

---

## Anamorphic Desqueeze & Distortion

### Anamorphic Overview
Anamorphic lenses squeeze a wider field of view onto the sensor horizontally.
Common squeeze ratios:
- **2× squeeze** — classic anamorphic; 2× wider captured, shown at 2.39:1
- **1.33× squeeze** — modern anamorphic for 4:3 sensors; delivers 1.78:1 (16:9)
- **1.5× squeeze** — some modern glass (e.g., Cooke Anamorphic/i)
- **1.25× squeeze** — some DJI and compact anamorphic adapters

### Desqueeze Before Anything
1. **Always desqueeze before tracking, roto, or any VFX work**
2. Apply correct pixel aspect ratio in your DCC: a 2× squeeze = pixel aspect 2.0
3. In 3DE: set `Pixel Aspect` correctly in camera settings
4. In Nuke: use `Reformat` or set Read node's pixel aspect to the squeeze ratio
5. Visual confirmation: circular objects (wheels, balls) should appear circular after desqueeze

### Anamorphic Distortion Characteristics
- **Horizontal distortion**: typically barrel, especially toward frame edges
- **Vertical distortion**: minimal or slightly pincushion
- **Elliptical bokeh**: out-of-focus highlights appear as horizontal ovals (the anamorphic "look")
- The distortion is **not symmetric** — different lens models per horizontal/vertical axes

### Anamorphic Lens Calibration
- Shoot calibration chart in **squeezed format** (do not pre-apply any desqueeze)
- Use the **Anamorphic Standard** lens model in 3DE (or equivalent)
- The model will solve both the squeeze ratio and the distortion shape simultaneously
- Check: after solving, circular objects in the plate should appear circular when desqueeze
  is applied via the solved model

---

## 3DE Lens Models

### Common Models in 3DEqualizer 4

| Model | Best For | Notes |
|-------|---------|-------|
| **3DE4 Radial - Standard, Degree 4** | Standard spherical lenses | Good general-purpose model |
| **3DE4 Radial - Physical, Degree 4** | Modern aspherical and zoom lenses | More complex; handles mustache distortion |
| **3DE4 Anamorphic - Standard, Degree 4** | Traditional anamorphic lenses | Handles separate H/V distortion |
| **3DE4 Anamorphic - Rescaled, Degree 4** | Modern anamorphic (non-2x squeeze ratios) | Solves squeeze ratio + distortion |
| **3DE Classic LD Model** | Legacy; simple barrel/pincushion | Use only if newer models fail |
| **3DE4 Radial - Fisheye, Degree 8** | Fisheye lenses | Extreme wide-angle |

### Model Selection Guide
1. Start with **3DE4 Radial - Standard** for spherical lenses
2. If residuals aren't improving below 0.3 pixels: try **Physical** model
3. For anamorphic: always use **Anamorphic Standard or Rescaled**
4. For zooms: calibrate at multiple focal lengths; interpolate model parameters

---

## Witness Camera Lens Calibration

**Witness cameras** are additional cameras on set capturing reference at non-hero angles,
often used for matchmove QC, additional angle reference, and sometimes as VFX elements.

### Witness Camera Setup
- Usually less controlled optics — but still require lens calibration for VFX use
- Shoot the same calibration grid at start/end of shoot day
- Document: camera make/model, lens, focal length, exact focus setting

### Witness Camera Solve Workflow
1. Calibrate lens from grid (as above)
2. Solve the witness camera independently from the hero camera
3. **Constrain both solves to the same world coordinate system** (survey points)
4. This allows you to cross-reference the two solves and verify accuracy

---

## Practical Workflow Checklist

### Pre-Shoot (Coordination with Camera Department)
- [ ] Confirm all lenses being used on the shoot with camera department
- [ ] Arrange lens calibration shoot (before or after primary shoot day)
- [ ] Prepare calibration targets (correct size for the lenses and shooting distances)
- [ ] Brief camera assistant on calibration procedure

### On Shoot Day
- [ ] Shoot lens calibration for every lens at every focal length used
- [ ] Document: camera body serial, lens serial, focal length (zooms: min/max/used), focus setting
- [ ] Photograph the calibration frames alongside a color checker (for verification)
- [ ] Keep calibration frames as RAW — do not apply any in-camera processing

### Post-Shoot
- [ ] Process calibration in 3DE (or PFBarrel / OpenCV)
- [ ] Generate undistort and redistort STMaps at full deliverable resolution
- [ ] Distribute STMaps to: matchmove team, compositing team, VFX facility
- [ ] Include STMaps in VFX turnover package with documentation
- [ ] Store calibration frames and 3DE project with project archive

### Common Issues
| Issue | Cause | Fix |
|-------|-------|-----|
| STMap creates visible seams or tearing | Wrong resolution or Y-axis convention | Confirm pixel-exact res; check Y inversion |
| Redistorted comp doesn't match plate edges | STMap generated at wrong plate format | Regenerate at exact plate resolution |
| Tracking residuals still high after distortion solve | Wrong lens model for this lens type | Try alternative 3DE model |
| Anamorphic objects look stretched after solve | Wrong squeeze ratio in model | Re-solve; confirm squeeze with camera dept |
| STMap looks blurry/low-quality | Exported at wrong bit depth | Regenerate as EXR 32-bit float |
