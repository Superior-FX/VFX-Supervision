# Camera Tracking & Matchmove Reference

## Table of Contents
1. [Matchmove Overview](#matchmove-overview)
2. [3DEqualizer Workflow](#3dequalizer-workflow)
3. [PFTrack Workflow](#pftrack-workflow)
4. [SynthEyes Workflow](#syntheyes-workflow)
5. [2.5D Tracking](#25d-tracking)
6. [LiDAR-Assisted Solving](#lidar-assisted-solving)
7. [Delivery Formats](#delivery-formats)
8. [QC Checklist](#qc-checklist)
9. [Difficult Shot Strategies](#difficult-shot-strategies)

---

## Matchmove Overview

**Matchmove** (camera tracking / 3D camera solve) reconstructs the real-world camera
movement from a filmed plate so that CG elements can be added in perfect registration.

### Types of Tracking
| Type | Description | Use Case |
|------|-------------|---------|
| **3D Camera Solve** | Full 3D camera position, rotation, FOV over time | CG element placement in 3D space |
| **Planar Track** | 2D tracking of a flat surface | Screen replacement, surface augmentation |
| **Object Track** | Track a moving object in 3D | CG replacement of a practical object |
| **Stabilization** | Remove or reduce camera shake | Cleanup, DMP, beauty work |
| **Geometry Track** | Track deforming geometry | Body augmentation, digital makeup |

### Requirements for a Good Solve
- Sharp, in-focus plate (motion blur is the enemy of tracking)
- Even distribution of track points across depth planes
- Reliable on-set data: **lens focal length, film back/sensor size, lens distortion data**
- Tracking markers or strong natural features in frame
- Minimal repeat pattern textures (brick, grass, water = difficult)

---

## 3DEqualizer Workflow

**3DEqualizer (3DE)** is the industry standard matchmove application. Used at virtually
every major VFX facility for hero shots.

### Project Setup
1. Create new project; set frame range to match plate (with handles)
2. Import footage (EXR, DPX, or reference proxy)
3. Set camera parameters:
   - **Focal length** (from camera report — confirm exact value)
   - **Film back / sensor size** (exact sensor width and height in mm)
   - **Pixel aspect ratio** (1.0 for spherical; 2.0 for anamorphic 2x squeeze)
4. Set **lens distortion mode** (see Lens Distortion reference for detail)

### Tracking Workflow
1. **Create 2D tracking points** on high-contrast features or tracking markers
2. Set track size to cover the feature without including surrounding elements
3. **Auto-track**: use for initial rough pass; always manually review every track
4. Correct drifting tracks frame-by-frame (add keyframes on track curves)
5. Aim for **minimum 8 tracks at any given frame**; ideally 15–30 for a reliable solve
6. Ensure tracks span multiple depth planes (near, mid, far)

### Lens Distortion Solve
1. If lens calibration grid is available: import and solve lens model before tracking
2. Undistort the plate before tracking (or use 3DE's internal distortion model)
3. 3DE lens models: **Anamorphic Standard**, **3DE4 Radial Standard**, **Classic LD Model**
4. Confirm distortion model matches lens type (see Lens Distortion reference)

### Camera Solve
1. **Set solve type**: Free move, Nodal pan, Zoom, or Locked
2. Select points for triangulation: need good spread across frame, multiple depth levels
3. Run solve; check **Mean Residuals** — target: <0.5 pixels; 0.2–0.3 for hero shots
4. Review solve in 3D view: camera path should be smooth and physically plausible
5. Correct outlier tracks and re-solve; iterate until residuals are acceptable

### Survey Data Integration
If on-set survey data is available:
1. Import survey points as 3D reference data
2. Constrain the solve to real-world scale and orientation
3. Benefits: real-world scale, correct gravity direction, accurate ground plane

### Export
- **FBX**: most universal; camera + point cloud + geometry
- **Maya .mel script**: camera ready to import to Maya
- **Nuke script snippet**: camera node for Nuke 3D
- **Alembic (.abc)**: animated camera; USD-compatible

---

## PFTrack Workflow

**PFTrack** (Foundry) — full-featured tracking suite; strong for complex shots with many
objects, geometry tracking, and auto-tracking features.

### Key Differentiators vs. 3DE
- **Auto camera solve** (PFTrack is more automated than 3DE's manual approach)
- **Object tracking** workflow is more integrated
- **Geometry tracking** (tracking a deforming mesh) built-in
- Better **crowd tracking** tools

### PFTrack Workflow Overview
1. Import footage, set camera parameters
2. Use **Auto Feature Tracking**: PFTrack detects and tracks features automatically
3. Review auto-tracks; delete bad tracks
4. **Camera Solve** node: triangulate from tracks
5. Review residuals and camera path; manually fix problem frames
6. Export camera via PFTrack export scripts (Nuke, Maya, FBX)

---

## SynthEyes Workflow

**SynthEyes** — cost-effective matchmove; strong for broadcast/episodic where 3DE budget
isn't justified. Good automated pipeline.

### When to Use SynthEyes vs. 3DE
| Scenario | SynthEyes | 3DE |
|---------|-----------|-----|
| Episodic / high-volume simpler shots | ✓ | |
| Hero feature film shots | | ✓ |
| Quick turnaround needed | ✓ | |
| Complex lens distortion / anamorphic | | ✓ |
| Budget-sensitive productions | ✓ | |
| Full-CG environment integration | | ✓ |

### SynthEyes Workflow
1. Import footage; set camera type (lens type, sensor size)
2. **Auto Tracking**: runs automatic feature detection and tracking
3. Solve; review histogram and solve error report
4. Clean bad tracks; re-solve
5. Export to Nuke, Maya, After Effects via built-in exporters

---

## 2.5D Tracking

**2.5D tracking** = planar tracking that can approximate 3D camera movement without a
full 3D solve. Used when a full 3D solve isn't required.

### When 2.5D Is Sufficient
- Screen replacement (flat surface, no parallax to surroundings)
- Sign replacement in locked or slowly panning shots
- Simple set extension on a flat wall or ground
- Any shot where the VFX element is on a planar surface

### Mocha Pro for 2.5D
1. Track the surface using planar tracker
2. Create a planar surface on the target area
3. Export: **After Effects Corner Pin** or **Nuke Corner Pin / Stabilize Data**
4. In Nuke: use STMap or Corner Pin node with the exported data

### Limitations
- Fails if there's significant parallax between the tracked surface and the comp element
- Not suitable for large objects placed in 3D space
- Breaking planes (camera moves around an object) are not handleable

---

## LiDAR-Assisted Solving

LiDAR provides a dense point cloud of the real-world environment that can dramatically
improve solve accuracy, especially for complex or low-texture environments.

### LiDAR Data Formats
- **E57** — universal exchange format; high accuracy
- **PTX / PTS** — Leica format
- **LAZ / LAS** — compressed LiDAR exchange
- **PLY / OBJ** — converted mesh from point cloud

### Workflow
1. Import LiDAR point cloud into 3DE or SynthEyes
2. Align point cloud to survey coordinate system
3. Use LiDAR points as **3D reference** — constrain solve to match LiDAR
4. Dramatically reduces scale ambiguity and drift
5. Result: accurate real-world scale; camera path precisely positioned in space

### LiDAR Registration
- Point cloud must be registered to a known coordinate system
- Use survey targets (high-visibility markers scanned and surveyed) to lock registration
- iPad-based LiDAR (poor accuracy) — useful for rough blocking only, not accurate enough
  for matchmove constraint

---

## Delivery Formats

### What Matchmove Artists Deliver

**Camera Files:**
| Format | Application | Notes |
|--------|------------|-------|
| `.nk` snippet | Nuke | Camera + point cloud scene as Nuke script paste |
| `.fbx` | Maya, Houdini, Blender, any 3D | Camera + geo |
| `.abc` (Alembic) | Houdini, Maya, USD | Animated camera data |
| `.chan` | Nuke, Houdini | Tab-separated transform channels |
| `.ma` | Maya ASCII | Maya-native; camera + scene |

**Scene Context:**
- **Point cloud** — reconstructed 3D points for scene context (FBX or separate OBJ)
- **Ground plane** — a geometry plane representing the floor for shadow placement
- **Set geometry** — simplified mesh of key set elements for shadow catchers
- **Undistort STmap** — for lens distortion workflow (see Lens Distortion reference)

**Render Settings:**
- Matchmove artist must provide: **sensor width, sensor height, focal length** per frame
  (can be static or animated for a zoom lens)
- Film back is embedded in the camera data for major formats

---

## QC Checklist

### Basic Solve QC
- [ ] Mean residuals: ≤ 0.5 pixels (≤ 0.3 for hero shots)
- [ ] No tracks with residuals consistently > 1.0 pixel
- [ ] Camera path is physically smooth (no jitter)
- [ ] World scale matches on-set measurements (if survey available)
- [ ] Camera sensor and focal length match camera report

### Nuke Integration QC
1. Import camera from matchmove artist into Nuke
2. Connect plate to viewer; add Camera node from solve
3. Create a Card3D at z=0; apply plate as projection
4. Render and overlay with original plate
5. **Features should not move relative to each other through the shot**
6. Check at cut-in and cut-out frames (most likely to drift)

### VFX Supervisor QC Review
- Load test CG element (sphere or box at contact point) into the Nuke comp
- Play through shot: element should appear stuck to set with zero drift
- For character/creature shots: confirm eyeline and contact point register correctly
- Check from cut-in to cut-out including handles

---

## Difficult Shot Strategies

### Low Texture (Blank Walls, Overcast Sky, Fog)
- **Strategy**: Focus on any available features; use every grain of texture
- Place high-contrast tracking markers before shoot — this is the only reliable fix
- If markers weren't placed: use LIDAR-assisted solve to constrain scale
- Consider a **nodal pan** solve if camera rotation only (no translation)
- Stabilize first, then add controlled drift

### Fast Motion / Motion Blur
- Blurry frames cannot be tracked — find sharp frames for anchor points
- Use **frame interpolation** to extract sharper sub-frames (RIFE)
- Solve on sharp frames only; interpolate camera path between them
- Increase search region size for tracking between blurry frames

### Handheld / Shaky Camera
- More track points = better solve (40–60 minimum)
- Use **short-range and long-range tracks** simultaneously
- Distribute tracks across all depth levels
- Expect more manual correction work per frame

### Extreme Close-Up
- Features move very fast; use very small search regions
- Use optical flow tracking assistance if available (3DE supports this)
- Track any available texture on skin, fabric, or prop surfaces
- Often requires geometry track of the subject itself

### Featureless Sky or Reflective Surfaces
- Remove these areas from the track — do not attempt to track mirrors or chrome
- Add masks to exclude the sky/reflective areas from the solve
- Rely entirely on features in other parts of the frame

### Anamorphic Lenses
- **Always desqueeze before tracking** (apply correct pixel aspect ratio in 3DE)
- Anamorphic has different horizontal vs. vertical distortion — the lens model must
  support this (use Anamorphic Standard or similar in 3DE)
- Oval bokeh circles confirm correct desqueeze when they become circular
- See Lens Distortion reference for full anamorphic workflow

### No Tracking Markers — Rescue Workflow
1. **Extract feature points** from SFM (Structure from Motion — COLMAP, RealityCapture)
2. If the location is accessible: capture **photogrammetry post-shoot** and use as reference
3. Use **any visible features**: pavement cracks, grass blades, debris
4. Combine with LiDAR if available
5. Accept lower-quality solve and compensate in comp (stabilize element to plate)
