# On-Set Supervision Reference

## Table of Contents
1. [VFX On-Set Role & Responsibilities](#vfx-on-set-role--responsibilities)
2. [HDRI Capture](#hdri-capture)
3. [Photogrammetry & LiDAR Scanning](#photogrammetry--lidar-scanning)
4. [Surveying & Measurements](#surveying--measurements)
5. [Tracking Markers](#tracking-markers)
6. [Greenscreen / Bluescreen Setup](#greenscreen--bluescreen-setup)
7. [LED Volume / ICVFX](#led-volume--icvfx)
8. [Clean Plate Strategy](#clean-plate-strategy)
9. [Reference Photography](#reference-photography)
10. [On-Set Data Management & Reporting](#on-set-data-management--reporting)

---

## VFX On-Set Role & Responsibilities

### Before Each Setup
- Review the shot in context of the VFX brief
- Confirm tracking marker placement with camera/grip
- Brief the director and DP on VFX requirements for this setup
- Ensure reference photography and HDRI unit is ready
- Confirm clean plate plan with 1st AD

### During Each Setup
- Watch for continuity errors that affect VFX (lighting changes, set dressing movement)
- Monitor tracking marker visibility and density in frame
- Flag any issues that increase post workload — document with photos
- Confirm matching conditions for clean plate (camera locked, same lens, same exposure)

### End of Day
- Complete VFX daily report (shots covered, issues, reference captured)
- Confirm HDRI captures are backed up to at least two drives
- Distribute daily report to VFX coordinator and post supervisor

---

## HDRI Capture

HDRI (High Dynamic Range Imaging) provides lighting reference for integrating CG elements.
It captures the full dynamic range of the lighting environment for use in CG rendering.

### Equipment
- **Mirror ball** (chrome ball, 12"–18") — captures full 360° environment in single shot
- **Grey ball** (18% grey) — captures diffuse lighting without specular highlights
- **Tripod + ballhead** — eye level by default; match CG asset position when practical
- **Camera** — typically full-frame stills (Sony A7 series, Nikon Z, etc.)
- **Bracketing body** — auto-exposure bracketing at tight intervals
- **Fisheye or very wide lens** — for panoramic HDRI (alternative to chrome ball)

### Capture Protocol — Chrome Ball Method
1. Position ball at **talent eye height** (or at the CG element's position in frame)
2. Set camera to **manual exposure**, lock ISO and aperture
3. Shoot **bracketed sequence**: expose from deepest shadow detail to clipped sun
   - Typical range: 7–11 exposures in **1-stop increments**
   - Example: EV-6 through EV+4 if mid-grey is 0
4. Shoot ball from **two positions** (camera side + opposite side) to capture full sphere
5. Shoot a **grey ball** at the same position to capture softbox / diffuse light ratios
6. **Immediately after each lighting change** — shoot a new HDRI

### Capture Protocol — Panoramic / Fisheye Method
1. Mount fisheye on ball head with panning base
2. Shoot full panorama: **at minimum 4 rotations × 3 tilt positions** (horizontal, up, down)
3. Bracket each position (same protocol as above)
4. Merge in PTGui, Hugin, or similar for full equirectangular HDRI

### Bracketing Best Practices
- Never use auto-exposure; the camera must not change settings between brackets
- Check that **brightest exposure captures shadow detail**; dimmest captures sun disk
- For interiors with practical windows: include extra overexposed brackets to capture
  window luminance (windows are often 10,000× brighter than interior surfaces)

### Processing HDRIs
- Merge in **Lightroom / ACR, PTGui, or Photosphere**
- Output as **32-bit EXR** — never JPEG or 8-bit
- Label clearly: `SCENE_015_A_HDRI_EYE_v001.exr`
- Deliver with a text file noting: time, location, light conditions, metering notes

### Frequency of Capture
| Event | Capture Required? |
|-------|------------------|
| Every lighting change | Yes — always |
| Before first shot of day | Yes |
| After lunch (natural light change) | Yes (exteriors) |
| After significant cloud changes | Yes (exteriors) |
| Same setup, no changes | No — reference previous capture |

---

## Photogrammetry & LiDAR Scanning

### When to Use
- CG environment that must match a practical set or location
- Digital double / prop model needed for compositing or full CG shot
- Complex practical set piece being replaced or extended

### Photogrammetry
**Goal:** Capture enough overlapping photos to reconstruct geometry via SfM (Structure from Motion).

**Protocol:**
1. Even, diffuse lighting — no hard shadows (overcast exterior or bounced interior)
2. Shoot overlapping series at **3 heights**: waist, eye, above — 20–30% overlap between frames
3. For each section: shoot **horizontal ring** around subject, full 360°
4. Minimum: **100–200 images** for medium complexity subject
5. Place **photogrammetry targets** (coded targets) around the subject; surveyors can
   provide X/Y/Z positions for scale accuracy
6. Capture reference with a **color checker** in frame for texture color accuracy

**Software:** RealityCapture (fastest), Metashape (most control), COLMAP (free/open source)

**Deliverables to facility:**
- Cleaned, decimated mesh (OBJ / FBX / USD)
- Texture maps (diffuse, normal — 4K or 8K as agreed)
- Scale reference documentation

### LiDAR Scanning
**When to use:** Complex environments, large spaces, precise measurement requirements.

- **Equipment:** Faro Focus, Leica BLK360, or iPad-based (less accurate, but fast)
- **Output:** Point cloud (.e57, .pts, .las) — import into RealityCapture, Recap, or Houdini
- **Combine with photogrammetry** for best result: LiDAR for geometry, photos for texture
- **iPad LiDAR (iPhone Pro, iPad Pro):** Acceptable for rough blocking and matchmove reference;
  not sufficient for hero geometry

---

## Surveying & Measurements

### Minimum Measurements to Capture
| Element | Why |
|---------|-----|
| Camera position (X/Y/Z) | Matchmove reference |
| Lens focal length | Matchmove |
| Film back / sensor size | Matchmove |
| Key practical set dimensions | Set extension alignment |
| Tracking target positions | Matchmove scale calibration |
| Table height, eyeline height | CG element placement |

### Measurement Tools
- **Laser measure** (Leica Disto or similar) — fast, accurate to ±1mm
- **Total station / survey equipment** — for high-accuracy matchmove-critical shoots
- **Tape measure** — minimum viable; confirm mm precision where needed

### Survey Output
- Provide measurements as a dimensioned diagram or CAD sketch
- Include a **scale reference photo** (measure in frame if possible)
- Upload to VFX data folder, reference in daily report

---

## Tracking Markers

### Purpose
Tracking markers provide high-contrast features that matchmove software can reliably
detect and track across frames.

### Marker Specifications
| Parameter | Recommendation |
|-----------|---------------|
| Design | Circular dot or X cross on contrasting background |
| Color | Black on white matte card / white on black matte card |
| Surface | Matte — no reflective or glossy materials |
| Size at distance | Minimum **4–6 pixels in frame** at furthest point in shot |
| Size guideline | ~10cm diameter at 10m distance; scale up proportionally |
| Quantity | Minimum **40–60 markers** per major surface |
| Distribution | Even spread — avoid clustering; cover all depth planes |

### Marker Placement Strategy
- Cover **all planes of motion** (floor, walls, ceiling for interiors)
- Ensure markers visible from **both cut-in and cut-out points** of shot
- For camera moves: ensure markers remain in frame **throughout the entire move**
- For handheld: place markers at multiple depths — near, mid, far
- For close-up shots: use smaller markers or temporary dot stickers on practical surfaces
- Avoid placing markers where they'll be obstructed by talent or props in key moments

### Removing Markers
- Markers must be removed in clean plates
- Keep a **photo reference of each marker placement** for easy identification in cleanup
- Brief props/art department: don't remove markers during shooting day

### Anamorphic Considerations
- Account for horizontal squeezing when sizing markers — markers will appear narrower
  in frame during review; size for the **desqueezed** frame

---

## Greenscreen / Bluescreen Setup

### Green vs. Blue — When to Choose Each
| Scenario | Recommended |
|----------|------------|
| Standard / most common | Green (2 stops brighter than blue; less light required) |
| Talent wearing green | Blue |
| Heavy blue light on set (LEDs, day exterior windows) | Green |
| Heavy green (foliage, practical sets) | Blue |
| Film scan / older cameras | Blue (historically better blue channel S/N ratio) |
| Digital cinema cameras | Green preferred |

### Lighting a Greenscreen
1. **Even illumination is critical** — maximize evenness; aim for ±0.5 stop variation
   across the entire screen
2. Use a **light meter or camera waveform** to confirm evenness, not your eye
3. **Distance ratio** — screen should be at least **2× the talent height** away from
   talent to minimize spill
4. Angle lights to the screen at **45°** from behind talent's plane to minimize
   back-reflection on talent
5. Screen luminance: Expose screen at **about 1 stop above middle grey** — don't
   overexpose (destroys chroma); don't underexpose (reduces chroma S/N ratio)

### Spill Suppression
- Physical separation (distance) is the most effective spill control
- **Flags and cutters** to prevent screen light from wrapping onto talent
- **Practical lighting** on talent should be stronger than screen bounce
- Note significant spill in VFX report so compositors can plan despill

### Shooting Checklist
- [ ] Evenness check with light meter before each setup
- [ ] Check for wrinkles or seams in screen
- [ ] Shoot a frame without talent for clean plate (every setup)
- [ ] Note lens focal length, T-stop, ISO, shutter angle in VFX report
- [ ] Confirm foreground plate and background reference are shot at matching frame rates

---

## LED Volume / ICVFX

In-Camera VFX uses large LED walls to display CG environments, allowing camera to capture
talent and background in-camera.

### Key Technical Concepts
- **Frustum** — the portion of the LED wall rendered in correct perspective for the camera
- **Outer frustum** — surrounding area rendered for ambient light bounce only
- **Tracking system** — camera tracking (optical or mechanical) drives frustum update in real-time
- **Genlock** — synchronizing LED wall and camera to prevent scanning artifacts
- **Camera shutter angle** — affects whether wall scan lines are visible; test before production

### Pre-Production Requirements
- **LED volume spec review**: pixel pitch (p2.6, p3.9, etc.), total resolution, refresh rate
  (must be ≥ 2× camera frame rate to avoid flicker)
- **Color calibration** of LED wall before shoot; get calibration report
- **Unreal Engine (or equivalent)** build: establish pipeline between VFX and real-time team
- **Tracking system validation**: confirm tracking latency is under 1 frame (ideally < 3ms)

### On-Set VFX Role for LED Volume
- Confirm **frustum alignment** with DP and camera team before each setup
- Monitor for **color mismatch** between practical set and LED wall
- Check for **moire or rolling shutter** on the wall — adjust shutter angle if needed
- Confirm **motion blur matching** between plate and CG (shutter angle, motion vectors)
- Capture **HDRI of the LED wall** as lighting reference for any supplementary CG

### Common LED Volume Issues
| Problem | Cause | Fix |
|---------|-------|-----|
| Color mismatch at edge of set | Outer frustum too dark | Increase outer frustum brightness |
| Rolling artifacts on wall | Shutter too fast vs wall refresh | Open shutter angle; confirm genlock |
| Parallax mismatch | Tracking system lag | Reduce latency; use motion blur to hide |
| Over-saturated LED wall | Wall not calibrated to scene colorspace | Recalibrate with OCIO display transform |

---

## Clean Plate Strategy

A clean plate is a frame (or sequence) with no people, rigs, or elements that need to be
removed — captured so compositors can cleanly replace them.

### When to Capture
- **Before principal photography** in each location or stage setup
- **After wrap** of each major setup (additional coverage)
- If lighting changes during shoot, capture **additional clean plates per lighting state**

### Clean Plate Checklist
- [ ] Same lens as shooting lens
- [ ] Same exposure / T-stop / ISO as shooting conditions
- [ ] Same focus pull as primary action
- [ ] Camera locked to same position (do NOT move camera between plate and clean)
- [ ] All talent, rig, and equipment cleared from set
- [ ] Art department: confirm set dressing matches primary shooting state
- [ ] Minimum **3–5 seconds** of clean plate (longer for backgrounds with movement)
- [ ] Note clean plate in camera report and VFX daily report

---

## Reference Photography

### Categories of Reference to Capture
| Type | Content | Format |
|------|---------|--------|
| 360° stills | Full environment panorama | JPEG + RAW, equirectangular if possible |
| Detail reference | Texture / material reference | RAW, macro where possible |
| Practical set reference | All walls, floor, ceiling from 4 directions | RAW |
| Scale reference | Object of known size in frame | RAW |
| HDRI (see above) | Chrome ball + grey ball | RAW brackets |
| Matchmove reference | Tracking target layout photos | JPEG acceptable |
| Continuity | Specific set dressing, talent position | JPEG acceptable |

### Photo Naming Convention
`SHOW_SC###_SETUP_TYPE_####.extension`
Example: `PROJ_SC015_A_HDRI_0001.cr3`

---

## On-Set Data Management & Reporting

### VFX Daily Report Contents
- Date, location/stage, scenes covered
- VFX shots filmed (scene/shot/take)
- Any VFX concerns or issues
- Reference captured (HDRI, photogrammetry, clean plates)
- Outstanding items from previous days
- Requests to art department, camera, grip, production

### Data Handling
- VFX reference should be **backed up to 2 drives** before leaving set
- Label drives: `SHOW_VFXREF_DAY###`
- Deliver copies to: VFX coordinator + 1 offsite backup
- Log all captures in a reference log spreadsheet (filename, scene, date, type)

### Communication Chain
VFX Supervisor → VFX Coordinator → Post VFX Supervisor → VFX Vendors
- Daily reports go to **VFX Coordinator** end of day
- Major issues (shot impossible as designed) escalate to **Director and Producer** immediately
- Do not modify shots without director approval — document all decisions
