# System Overview & Planning

## Table of Contents
1. [What Is DIY Motion Capture](#what-is-diy-motion-capture)
2. [IMU vs Optical — Full Comparison](#imu-vs-optical--full-comparison)
3. [Budget Planning](#budget-planning)
4. [Use Case Selection](#use-case-selection)
5. [Full Parts List by Approach](#full-parts-list-by-approach)
6. [Timeline to Working System](#timeline-to-working-system)

---

## What Is DIY Motion Capture

Motion capture records the movement of a person's body and translates it into digital
skeleton animation data. The data drives a 3D character rig in software like Blender,
Unreal Engine, or Maya.

**Two fundamentally different technologies:**

**IMU (Inertial Measurement Unit)** — sensors strapped to each body segment measure
acceleration and angular velocity. Sensor fusion algorithms compute orientation of each
segment. The skeleton is solved from relative orientations — no cameras required.

**Optical (Marker-Based)** — reflective or active markers placed on the body are
tracked by multiple cameras. The 3D positions of each marker are triangulated and solved
into a skeleton. Requires a calibrated camera array.

---

## IMU vs Optical — Full Comparison

| Feature | IMU (Inertial) | Optical |
|---------|---------------|---------|
| **Position tracking** | Rotation only — no absolute world position | Full 6DOF (position + rotation) |
| **Accuracy** | ±2–5° rotation; positional drift over time | Sub-millimeter marker position |
| **Occlusion** | Not an issue | Markers must be visible to ≥2 cameras |
| **Environment** | Anywhere — outdoors, moving spaces | Needs dedicated capture volume |
| **Latency** | Low (~10–20ms) | Low (~5–15ms with good hardware) |
| **Cameras needed** | None | 6–12 minimum for full body |
| **DIY cost** | $150–$600 | $500–$3,000+ |
| **Setup time per session** | 10–15 min (suit on, calibrate) | 30–60 min (camera setup, calibration) |
| **Fingers/face** | Not practical | Possible with specialized markers |
| **Best software (DIY)** | SlimeVR, XSens-style pipelines | FreeMoCap, iPi Soft, Brekel |
| **Output** | BVH via SteamVR/Blender addon | BVH, FBX, C3D |
| **Main limitation** | No positional data; foot skating | Occlusion; camera volume constraint |

---

## Budget Planning

### IMU Build — Cost Breakdown

| Component | Qty | Unit Cost | Total |
|-----------|-----|-----------|-------|
| BNO085 breakout board | 17–20 | $5–$15 | $85–$300 |
| ESP32 dev board (WiFi) | 5–7 (as hubs) | $3–$8 | $15–$56 |
| 3.7V LiPo battery (400–800mAh) | 17–20 | $3–$6 | $51–$120 |
| LiPo charge board (TP4056) | 17–20 | $0.50–$1 | $9–$20 |
| Wiring, connectors, heat shrink | — | — | $10–$20 |
| Spandex base suit | 1 | $20–$60 | $20–$60 |
| 3D printed cases (optional) | — | — | $10–$30 filament |
| **Total** | | | **$200–$606** |

**Pre-assembled SlimeVR kit (official or community):** ~$200–$300 for 11 trackers

### Optical Build — Cost Breakdown

| Component | Qty | Unit Cost | Total |
|-----------|-----|-----------|-------|
| IR-modified webcam (or PS3 Eye) | 6–8 | $15–$40 | $90–$320 |
| IR bandpass filter (850nm) | 6–8 | $3–$8 | $18–$64 |
| IR LED ring for each camera | 6–8 | $5–$15 | $30–$120 |
| Camera mounting hardware | — | — | $30–$80 |
| Retroreflective markers (3M tape) | 1 roll | $20–$40 | $20–$40 |
| USB hubs / PCIe USB cards | — | — | $30–$60 |
| **Total (software separate)** | | | **$218–$684** |

**Software:**
- **FreeMoCap**: Free (open source)
- **iPi Soft Studio**: $395/year (PS3 Eye cameras compatible)
- **Brekel Body Pro**: $99 (Kinect-based, different approach)

---

## Use Case Selection

### Animation for Games / Film (Character Animation)
**Best fit:** IMU (SlimeVR) or optical (FreeMoCap)
- You need BVH or FBX output
- Retarget in Blender or MotionBuilder
- IMU is sufficient for full-body walk cycles, fights, dance
- Use optical if you need finger tracking or precise contact points

### VR / Real-Time Avatar (Social VR, VTubing)
**Best fit:** IMU (SlimeVR)
- SlimeVR integrates directly with SteamVR
- Drives VRChat, VSeeFace, NeosVR avatars in real-time
- No post-processing needed — live streaming to VR app

### Biomechanics / Research / Sports Analysis
**Best fit:** Optical (FreeMoCap or commercial)
- Need absolute positional data, not just rotation
- FreeMoCap uses standard webcams + MediaPipe pose estimation
- C3D output for scientific analysis tools

### Budget-Limited / Beginner
**Best fit:** IMU (SlimeVR)
- Most documented DIY path
- Largest community support
- Working system possible under $300

### Highest Quality DIY
**Best fit:** Optical with PS3 Eye cameras + iPi Soft
- PS3 Eye cameras are cheap ($10–$15 used) and IR-capable
- iPi Soft has the best consumer-level optical solving
- Requires more space and setup

---

## Full Parts List by Approach

### IMU Build (SlimeVR-Compatible) — Full Body 17 Sensors

**Electronics:**
- 17× BNO085 (Adafruit breakout or bare module)
- 5× ESP32-WROOM-32 (one per limb cluster: arms, legs, torso)
- 17× 500mAh 3.7V LiPo
- 17× TP4056 USB-C LiPo charger module
- 17× 100µF decoupling capacitor
- 22 AWG silicone wire (flexible, heat resistant)
- JST PH 2-pin connectors (battery) + JST SH 4-pin (I2C)
- Heat shrink tubing assorted sizes

**Fabrication:**
- Tight spandex/lycra full-body suit (or separate top + leggings)
- Elastic velcro straps (2.5cm wide) × 20
- Sew-on velcro patches × 40
- Small neoprene pouches or 3D-printed TPU cases for sensors

**Tools:**
- Soldering iron + solder
- Multimeter
- 3D printer (optional for cases)
- USB-C cables for flashing/charging

### Optical Build — FreeMoCap (Budget)

**Hardware:**
- 4–6× 1080p webcams (Logitech C920 or C922 recommended)
- Camera tripods / clamps for mounting
- 3M Scotchlite 8910 reflective tape (make markers from tape circles)
- OR pre-made 14mm retroreflective spherical markers
- Black tight-fitting suit (to maximize marker contrast)
- Good diffuse room lighting (avoid harsh shadows)

**Software (all free):**
- FreeMoCap (freemocap.org)
- Blender + freemocap addon
- Python 3.10+ (FreeMoCap dependency)

---

## Timeline to Working System

### IMU / SlimeVR Build

| Phase | Time |
|-------|------|
| Parts ordering | 1–3 weeks (shipping) |
| Soldering all sensors | 3–8 hours |
| Flashing firmware | 1–2 hours |
| Sewing suit / mounting | 2–4 hours |
| Software setup + calibration | 1–2 hours |
| First usable capture | **~1 weekend after parts arrive** |

### Optical / FreeMoCap Build

| Phase | Time |
|-------|------|
| Parts ordering | 1–2 weeks |
| Camera mounting setup | 2–3 hours |
| Software install (FreeMoCap + Python) | 1–2 hours |
| Camera calibration | 1–2 hours |
| Marker placement learning | 1 hour |
| First usable capture | **~1 day after parts arrive** |
