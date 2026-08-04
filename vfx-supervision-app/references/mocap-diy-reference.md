# DIY Motion Capture Suit — Complete Build Reference

**Version 1.0** | Covers IMU-based and optical approaches from hardware through animation pipeline

---

## Table of Contents

1. [What Is Motion Capture](#1-what-is-motion-capture)
2. [Choosing Your Approach: IMU vs Optical](#2-choosing-your-approach-imu-vs-optical)
3. [IMU Build: Parts & Hardware](#3-imu-build-parts--hardware)
4. [IMU Build: Wiring & Electronics](#4-imu-build-wiring--electronics)
5. [Suit Design & Fabrication](#5-suit-design--fabrication)
6. [Sensor Placement](#6-sensor-placement)
7. [Firmware & Software Setup (SlimeVR)](#7-firmware--software-setup-slimevr)
8. [Sensor Fusion: How It Works](#8-sensor-fusion-how-it-works)
9. [Optical Build: Cameras & Markers](#9-optical-build-cameras--markers)
10. [Software Pipeline: Capture to Animation](#10-software-pipeline-capture-to-animation)
11. [Retargeting Mocap Data in Blender](#11-retargeting-mocap-data-in-blender)
12. [Unreal Engine Integration](#12-unreal-engine-integration)
13. [Budget Summary](#13-budget-summary)
14. [Troubleshooting](#14-troubleshooting)
15. [Resources & Community](#15-resources--community)

---

## 1. What Is Motion Capture

Motion capture (mocap) records the real-world movement of a human body and converts it into digital skeleton animation data. That data can then drive a 3D character rig in software like Blender, Unreal Engine, or Maya.

**The output is not video.** It's a set of rotation and position values for each joint in a skeleton, recorded over time — typically saved as a `.bvh` or `.fbx` file, or streamed in real-time to a 3D application.

**Two fundamentally different technologies exist:**

**IMU (Inertial Measurement Unit):** Small sensors strapped to each body segment. Each sensor measures acceleration and rotation using accelerometers, gyroscopes, and magnetometers. A sensor fusion algorithm combines these readings into a stable orientation estimate. The skeleton is solved from the relative orientations of all segments. No cameras required.

**Optical (Marker-Based):** Reflective or active markers placed on the body are tracked by multiple cameras. The 3D position of each marker is triangulated from the camera views and solved into a skeleton. More accurate than IMU, but requires a dedicated camera setup and capture space.

---

## 2. Choosing Your Approach: IMU vs Optical

| | IMU (Inertial) | Optical (Marker-Based) |
|--|---------------|----------------------|
| **Position tracking** | Rotation only — no absolute world position | Full 6DOF (position + rotation) |
| **Accuracy** | ±2–5° rotation; positional drift over time | Sub-millimeter marker position |
| **Occlusion** | Not affected | Markers must be visible to ≥2 cameras |
| **Environment** | Anywhere — outdoors, any space | Needs dedicated capture volume |
| **Cameras needed** | None | 6–12 minimum for full body |
| **DIY cost** | $150–$600 | $500–$3,000+ |
| **Setup time per session** | 10–15 min | 30–60 min |
| **Best DIY software** | SlimeVR | FreeMoCap, iPi Soft |
| **Main limitation** | No positional data; foot skating | Camera occlusion; fixed volume |

**Recommendation for first build:** Start with IMU (SlimeVR). It's the most documented DIY path, has the largest community, and can produce usable animation data under $300. Add optical later if precision is needed.

---

## 3. IMU Build: Parts & Hardware

### Sensor: BNO085 (Recommended)

The BNO085 is the best IMU sensor for DIY mocap due to its on-chip sensor fusion algorithm, which dramatically reduces drift compared to software-only solutions.

| Parameter | Value |
|-----------|-------|
| Interface | I2C (default), SPI |
| Supply voltage | 3.3V |
| Current draw | ~1.4mA active |
| Output | Quaternion (ARVR Stabilized), raw data |
| I2C addresses | 0x4A (default) or 0x4B (ADDR pin high) |
| Max sensors per bus | 2 (use TCA9548A multiplexer for more) |

**Where to buy:** Adafruit BNO085 breakout ($14.95) or bare modules from AliExpress/LCSC ($3–$6). The Adafruit version is easiest for beginners — it includes level shifting and pull-up resistors.

**Avoid the MPU-6050 for mocap.** It has no magnetometer and drifts significantly. The MPU-9250 is acceptable but requires more complex firmware. The BNO085 simply works better.

### Microcontroller: ESP32

One ESP32 acts as a hub for a cluster of BNO085 sensors. It reads sensor data over I2C and transmits it over WiFi to the SlimeVR server on your PC.

**Why ESP32:** Built-in 2.4GHz WiFi, 3.3V logic (matches BNO085 directly), dual-core 240MHz processor, cheap ($3–$8), and has excellent SlimeVR firmware support.

**Recommended variant:** Generic ESP32-WROOM-32 for most hubs. XIAO ESP32C3 for compact installations (hands, feet). ESP32-S3 if you need more than 3 sensors per hub.

### Full Parts List (17-Sensor Full Body Build)

**Electronics:**
- 17× BNO085 breakout boards
- 5× ESP32-WROOM-32 dev boards (one hub per limb cluster)
- 17× 500mAh 3.7V LiPo batteries (403040 or similar)
- 17× TP4056 USB-C LiPo charger modules (with protection circuit)
- 17× 100µF electrolytic capacitors (decoupling)
- 22 AWG silicone-insulated wire (flexible)
- JST PH 2-pin connectors for batteries
- JST SH 4-pin connectors for I2C
- Heat shrink tubing (assorted)

**Fabrication:**
- Full-body compression spandex suit (1 size small)
- 2.5cm elastic velcro straps × 20
- Sew-on velcro patches × 40
- Neoprene or scuba fabric (for sensor pockets)
- Thread, needle or sewing machine

**Tools:**
- Soldering iron + solder
- Multimeter
- USB-C cables for flashing and charging
- 3D printer (optional — for sensor cases)

---

## 4. IMU Build: Wiring & Electronics

### Hub Architecture

Rather than wiring every sensor to a single central board (a messy harness), group sensors into 5 hubs, one per limb cluster:

| Hub | Sensors | Location on Body |
|-----|---------|-----------------|
| Torso | Chest + Hips + Head (+ optional shoulders) | Center back |
| Left Arm | Upper arm L + Lower arm L + Hand L | Outer upper arm |
| Right Arm | Upper arm R + Lower arm R + Hand R | Outer upper arm |
| Left Leg | Upper leg L + Lower leg L + Foot L | Outer upper thigh |
| Right Leg | Upper leg R + Lower leg R + Foot R | Outer upper thigh |

### I2C Wiring (Per Hub, 3 Sensors)

```
ESP32 3.3V ─────┬──── BNO085 #1 VIN
                ├──── BNO085 #2 VIN
                └──── BNO085 #3 VIN (via TCA9548A)

ESP32 GND ──────┬──── BNO085 #1 GND
                ├──── BNO085 #2 GND
                └──── BNO085 #3 GND

GPIO21 (SDA) ───┬──── BNO085 #1 SDA ── 4.7kΩ pullup to 3.3V
                ├──── BNO085 #2 SDA
                └──── BNO085 #3 SDA

GPIO22 (SCL) ───┬──── BNO085 #1 SCL ── 4.7kΩ pullup to 3.3V
                ├──── BNO085 #2 SCL
                └──── BNO085 #3 SCL

BNO085 #1 ADDR → GND     (I2C address 0x4A)
BNO085 #2 ADDR → 3.3V    (I2C address 0x4B)
BNO085 #3       → TCA9548A channel 0 (separate address space)
```

**Important:** Add a 100µF capacitor across 3.3V and GND near each sensor cluster to decouple power supply noise from WiFi transmission bursts.

### Power Circuit (Per Hub)

```
LiPo Battery (+) → TP4056 B+
LiPo Battery (-) → TP4056 B-
TP4056 OUT+      → ESP32 VIN (or 3.3V via regulator)
TP4056 OUT-      → ESP32 GND
USB-C port on TP4056 for charging
```

A 500mAh LiPo provides approximately 2–3 hours of capture time per hub. Use 800mAh for longer sessions.

---

## 5. Suit Design & Fabrication

### Base Layer

The suit must be tight enough to prevent sensor movement during capture. Any slipping causes inaccurate rotation data.

**Best choice:** Full-body compression spandex/lycra suit, bought 1 size smaller than your normal size. Dancewear companies (Danzcue, Discount Dance Supply) sell full-body zentai or unitard styles for $20–$60. For optical capture, choose black or dark navy — maximizes marker contrast.

### Sensor Pocket Construction

**Sewn neoprene pockets (recommended for permanent builds):**
1. Cut neoprene into rectangles with 5mm clearance around the sensor PCB on all sides
2. Fold and sew three sides to form a pocket
3. Sew the open pocket onto the suit at the sensor position, opening facing the body
4. Add a small velcro flap to retain the sensor

**Velcro attachment (fastest for prototyping):**
1. Sew hook-side velcro patches onto the suit at each sensor position
2. 3D-print small TPU cases with loop-side velcro on the back
3. Press sensor cases onto suit; remove for charging

### Wiring Channels

Sew small fabric channels (tubes ~1cm diameter) along the suit's inner seams to route wires between sensors and hubs. Leave 20–30% extra wire length at each joint to allow for full range of motion without pulling connections loose. Use silicone-insulated wire — it remains flexible and won't stiffen.

### Anti-Rotation Straps

Lower leg and thigh sensors are most prone to rotating around the limb. Add a second strap 5–8cm above or below the sensor pocket to prevent rotation. Silicone grip strips sewn inside straps help considerably.

---

## 6. Sensor Placement

### Full Body 17-Point Map

```
                    ● HEAD
                    (back of skull, center)
                         │
         ●───────────────●───────────────●
    SHOULDER L        CHEST              SHOULDER R
    (acromion)      (sternum)            (acromion)
         │                                    │
         ● UPPER ARM L                   ● UPPER ARM R
         (mid-humerus outer)             (mid-humerus outer)
         │                                    │
         ● LOWER ARM L                   ● LOWER ARM R
         (mid-forearm outer)             (mid-forearm outer)
         │                                    │
         ● HAND L                        ● HAND R
         (back of hand)                  (back of hand)

                    ● HIPS ← most critical sensor
                   (sacrum, lower back)
                         │
         ●───────────────┘───────────────●
    UPPER LEG L                     UPPER LEG R
    (outer mid-thigh)               (outer mid-thigh)
         │                                    │
         ● LOWER LEG L                   ● LOWER LEG R
         (outer mid-shin)               (outer mid-shin)
         │                                    │
         ● FOOT L                        ● FOOT R
         (top of foot, dorsum)           (top of foot, dorsum)
```

### Placement Rules

**Hips/sacrum** is the root of the skeleton and the single most critical sensor. Attach it firmly with both velcro and an elastic waistband strap. If the hips sensor shifts, the entire skeleton breaks.

**Place sensors on bone prominences, not muscle bellies.** Mid-shaft of the humerus/femur/tibia is stable. Avoid the bicep or calf — these change shape during contraction.

**Outer surface of limbs** is preferred — less skin-on-skin contact than inner surface, more stable.

**Minimum viable set (6 sensors):** Hips + left/right upper leg + left/right lower leg + chest. Sufficient for walk cycles and basic locomotion.

---

## 7. Firmware & Software Setup (SlimeVR)

### Flashing SlimeVR Firmware

**Prerequisites:** VSCode, PlatformIO extension, Python 3.x, USB cable.

```bash
git clone https://github.com/SlimeVR/SlimeVR-Tracker-ESP
cd SlimeVR-Tracker-ESP
# Open in VSCode with PlatformIO
```

**Edit `src/defines.h`:**
```cpp
#define IMU IMU_BNO085        // Your sensor type
#define PIN_IMU_SDA 21        // ESP32 I2C SDA pin
#define PIN_IMU_SCL 22        // ESP32 I2C SCL pin
#define IMU_ROTATION DEG_90   // Adjust to match your mounting orientation
```

**Edit `credentials.h`:**
```cpp
#define WIFI_CREDS_SSID "YourNetworkName"
#define WIFI_CREDS_PASSWD "YourPassword"
```

Build and upload via PlatformIO. Monitor serial output to confirm the sensor is detected and WiFi connects.

### SlimeVR Server Setup

1. Download SlimeVR Server from `github.com/SlimeVR/SlimeVR-Server/releases`
2. Install Java 17+ (`winget install Microsoft.OpenJDK.17` on Windows)
3. Launch the server
4. Power on your ESP32 hubs — they auto-connect
5. Assign each tracker to a body part (drag the tracker icon to the body diagram)
6. Perform full reset in T-pose, then ankle calibration

### Per-Session Calibration

Before every capture session:
1. Power all hubs; wait 5 seconds for gyro stabilization
2. Stand in T-pose (arms out to sides, feet hip-width apart, looking forward)
3. Click "Full Reset" in SlimeVR Server
4. Stand upright, feet flat — click "Ankle Calibration"
5. Walk 5–10 steps; check for foot skating — redo ankle calibration if needed

### Recording BVH

SlimeVR Server has built-in BVH recording under the Recording tab. Start → perform motion → stop → a `.bvh` file is saved to your SlimeVR folder.

---

## 8. Sensor Fusion: How It Works

Each IMU sensor outputs raw data from three sensors: an accelerometer (measures linear acceleration including gravity), a gyroscope (measures rotation rate), and a magnetometer (measures magnetic field direction). None of these alone gives a stable orientation. Sensor fusion combines them.

**The core problem the Madgwick/Mahony algorithms solve:** The gyroscope is accurate over short time periods but drifts when its small errors are integrated over time. The accelerometer can measure the direction of gravity (giving tilt/pitch/roll) but is corrupted by movement acceleration. The magnetometer gives absolute heading (yaw) but is disturbed by nearby metal objects and electronics.

Fusion works by: using the gyroscope for high-frequency rotation tracking, and continuously correcting the accumulated drift using the gravity vector (from accelerometer) and magnetic north (from magnetometer) as absolute references. The `beta` parameter in the Madgwick filter controls how aggressively drift is corrected — higher beta corrects faster but introduces more noise from sensor motion.

The BNO085 runs this fusion internally on its dedicated processor. You simply read a quaternion output — four numbers (w, x, y, z) that together describe the sensor's orientation in 3D space. The SlimeVR firmware reads these quaternions and sends them over WiFi. The SlimeVR Server combines all quaternions into a skeleton pose.

---

## 9. Optical Build: Cameras & Markers

### Camera Setup

Arrange 6–8 cameras in a ring around the capture volume at 45° above eye level, spaced approximately 60° apart for a 6-camera setup. Each camera should point toward the center of the volume. The capture volume for 6 cameras is roughly 3m × 3m × 2.5m.

**PS3 Eye cameras** are the most cost-effective option for DIY optical ($10–$15 used on eBay). They support IR modification and are compatible with iPi Soft. Logitech C920/C922 cameras work with FreeMoCap without modification.

### IR Modification (PS3 Eye)

1. Remove the lens assembly
2. Extract the hot-mirror filter (small glass piece inside the lens)
3. Cut an 850nm bandpass filter to size and insert in its place
4. Reassemble and attach an 850nm IR LED ring around the lens housing
5. Result: camera detects retroreflective markers brightly under IR illumination, invisible in ambient room light

### Markers

**Retroreflective tape:** Cut 3M Scotchlite 8910 tape into 14–20mm circles using a leather or circle punch. Stick directly onto a black suit at marker positions. Cheap and replaceable.

**Spherical markers:** Pre-made 14mm retroreflective spheres (search "motion capture markers" on Amazon) give more consistent 3D shape for triangulation accuracy. Attach with velcro backing sewn to the suit.

### FreeMoCap (Free, Recommended)

```bash
pip install freemocap
python -m freemocap
```

FreeMoCap uses standard webcams with MediaPipe AI pose estimation — no IR modification needed for basic use. For a marker-based pipeline with PS3 Eyes, use iPi Soft ($395/year) or custom pipelines.

**FreeMoCap workflow:** Mount cameras → calibrate with ChArUco board → record session → process → export BVH or direct Blender scene.

---

## 10. Software Pipeline: Capture to Animation

### Full Pipeline Overview

```
Physical Capture
    (IMU suit or optical cameras)
         ↓
Tracking Server
    (SlimeVR Server or FreeMoCap)
         ↓
BVH / FBX Export
    (skeleton animation file)
         ↓
Retargeting
    (Blender, MotionBuilder, or Unreal IKRig)
         ↓
Cleanup & Polish
    (smooth curves, fix foot contact, remove jitter)
         ↓
Final Animation Asset
    (keyframed rig ready for game/film)
```

### BVH File Format

BVH (Biovision Hierarchy) is the standard output format from DIY mocap tools. It contains two sections: a HIERARCHY section defining the skeleton (joint names, parent-child relationships, initial offsets) and a MOTION section containing one line of data per frame.

**Key import settings in Blender:**
- Scale: `0.01` (BVH is usually in centimeters; Blender works in meters)
- Frame rate: match your capture frame rate (30fps is typical)
- Auto Bone Orientation: enable

---

## 11. Retargeting Mocap Data in Blender

Retargeting maps the captured skeleton's animation onto your character's rig, which will have different bone lengths, names, and orientations.

### Method 1: Rokoko Blender Plugin (Free tier available)

The Rokoko plugin includes a retargeting tool that maps bones between skeletons by name or manually.

1. Install: search "Rokoko Studio Live Link" on `extensions.blender.org`
2. Import your BVH (the mocap skeleton)
3. Select your character rig
4. Open the Rokoko panel → Retargeting
5. Map source bones (mocap) to target bones (character)
6. Click "Retarget" → baked animation applied to character

### Method 2: Action Constraints (Manual)

For each bone in your character rig, add a `Copy Rotation` constraint targeting the corresponding bone in the mocap armature. Then bake:

1. Select all bones on your character rig
2. `Pose → Animation → Bake Action`
3. Settings: Start/End frame, Only Selected Bones, Visual Keying, Clear Constraints
4. Result: baked keyframes on character, independent of mocap armature

### Method 3: Auto-Rig Pro ($40)

The most robust retargeting in Blender. Handles skeleton scale differences, bone orientation mismatches, and provides a clean UI for bone mapping. Worth the cost for regular mocap work.

### Cleanup Checklist

Raw mocap data needs cleanup before use:

- **Foot skating** — feet sliding on the ground when they should be planted. Fix with foot IK constraints or manually keyframe foot positions during contact phases.
- **Jitter** — small frame-to-frame noise. Select all bones in Graph Editor → `Key → Smooth Keys`. Apply sparingly — over-smoothing removes natural motion.
- **Drift** — slow positional or rotational drift accumulating over a long clip. Correct by anchoring reference bones at known positions.
- **Shoulder/hip pop** — sudden orientation flip on shoulder or hip bones. Find the frame in the Graph Editor where the rotation value jumps; manually interpolate through it.

---

## 12. Unreal Engine Integration

### BVH → FBX → Unreal

Unreal Engine does not natively import BVH. Convert first:

1. Import BVH into Blender
2. Select the armature + all bones
3. `File → Export → FBX`
4. Settings: Selected Objects only, Armature + Mesh, Bake Animation checked
5. Import FBX in Unreal: set skeleton to your character's skeleton

### IKRig Retargeting (Unreal Engine 5)

1. Create an `IKRig` asset for the source (mocap) skeleton
2. Create an `IKRig` asset for the target (character) skeleton
3. Create an `IKRetargeter` asset linking source to target
4. Map root bone, limb chains, and spine chains between the two
5. In the retargeter: `Export Retarget Animations` to bake retargeted sequences

### Live Link (Real-Time)

For real-time character driving in Unreal, community plugins allow SlimeVR to stream directly over Live Link. Search "SlimeVR Live Link Unreal" on GitHub for current plugin options. This enables real-time previewing of mocap performance on your character inside Unreal.

---

## 13. Budget Summary

### IMU Build (17 sensors, SlimeVR)

| Item | Cost |
|------|------|
| 17× BNO085 sensors | $85–$255 |
| 5× ESP32 boards | $15–$40 |
| Batteries + charging circuits | $60–$140 |
| Wiring + connectors | $10–$20 |
| Spandex suit + sewing materials | $30–$80 |
| **Total** | **$200–$535** |

### Optical Build (6-camera FreeMoCap)

| Item | Cost |
|------|------|
| 6× webcams (Logitech C920) | $180–$360 |
| Tripods / mounts | $30–$80 |
| Markers (3M Scotchlite tape) | $20–$40 |
| Black suit | $20–$40 |
| FreeMoCap software | Free |
| **Total** | **$250–$520** |

### Pre-Built Option

**Official SlimeVR kit** (11 trackers): ~$200–$300. Fastest path to working system. Fewer sensors than a full 17-point build but sufficient for basic full-body animation.

---

## 14. Troubleshooting

### IMU Issues

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Sensor not detected | Wiring fault or wrong I2C address | Check SDA/SCL; verify ADDR pin state |
| Yaw drifts slowly | Magnetic interference or no mag | Use BNO085 ARVR mode; move away from ferrous objects |
| Sensor values jump | WiFi packet loss | Use dedicated router; check range |
| Foot skating | Ankle calibration incomplete | Redo ankle calibration standing flat on floor |
| Axes are inverted/wrong | Wrong IMU_ROTATION value | Adjust DEG_0/90/180/270 in defines.h |
| Sensor drops mid-session | Low battery or weak WiFi | Charge between sessions; improve WiFi signal |
| T-pose reset doesn't hold | Sensor sliding on suit | Tighten mounting straps; add second strap |

### Optical Issues

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Camera not detected | USB bandwidth exceeded | Max 2 cameras per USB controller |
| Jittery markers | Motion blur or low resolution | Increase shutter speed; better cameras |
| Calibration fails | Board not visible to all cameras | Use larger ChArUco board; move more slowly |
| Marker ID swaps | Markers too close together | Increase spacing; add more cameras |

### Animation Pipeline Issues

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| BVH imports tiny | Scale mismatch (cm vs m) | Import with scale 0.01 in Blender |
| Character deforms wrong | Bone name/orientation mismatch | Redo bone mapping in retargeting tool |
| FBX has no animation | Export setting | Enable "Bake Animation" in FBX export |
| Mechanical-looking motion | Over-smoothed curves | Reduce smoothing iterations |

---

## 15. Resources & Community

### Official Documentation
- **SlimeVR Docs:** `docs.slimevr.dev` — firmware, server, calibration, everything IMU
- **FreeMoCap:** `freemocap.org` — optical mocap with standard webcams
- **SlimeVR GitHub:** `github.com/SlimeVR` — firmware source, server, community PCB designs

### Communities
- **SlimeVR Discord** — most active DIY mocap community; `#diy-trackers` channel for hardware help
- **r/mocap** — mixed professional and DIY; useful for pipeline questions
- **Blender Artists** — retargeting, cleanup, animation pipeline discussions

### Hardware Suppliers
- **Adafruit** — BNO085 breakouts, ESP32, LiPo batteries (best documentation, higher price)
- **SparkFun** — BNO085 with QWIIC connector
- **LCSC / AliExpress** — cheapest components; longer shipping; some QC risk
- **JLCPCB / PCBWay** — custom PCB fabrication if you design your own boards

### Recommended Learning Order
1. Read the SlimeVR docs completely before ordering parts
2. Build a single tracker first (1× ESP32 + 1× BNO085) and get it working end-to-end
3. Confirm BVH import in Blender works before building all 17 trackers
4. Scale up once the single-tracker pipeline is validated
5. Add optical capture later if IMU accuracy isn't sufficient for your use case
