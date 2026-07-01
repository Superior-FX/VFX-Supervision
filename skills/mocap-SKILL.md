---
name: mocap-diy
description: >
  DIY motion capture suit design, build, and pipeline reference. Use this skill whenever
  the user asks about building or designing a motion capture suit, IMU sensors, inertial
  mocap, optical mocap, marker placement, SlimeVR, BNO085, MPU-9250, ESP32, sensor fusion,
  Madgwick filter, BVH files, mocap retargeting, FreeMoCap, iPi Soft, mocap-to-Blender,
  mocap-to-Unreal, skeleton solving, suit fabrication, wiring harness, battery packs,
  or any DIY motion capture hardware or software pipeline topic. Trigger for partial
  matches — e.g. "how do I build a mocap suit", "what sensors do I need", "how does
  SlimeVR work", "how do I retarget mocap data", "what is sensor fusion".
---

# DIY Motion Capture Skill

Expert reference for designing, building, and using DIY motion capture systems —
covering both IMU-based and optical approaches, from hardware to final animation output.

---

## Domain Map — Which File to Read

| Domain | Reference File | Key Topics |
|--------|---------------|------------|
| System Overview & Planning | `references/overview.md` | IMU vs optical, cost, use-case selection, what you need |
| IMU Hardware (Sensors & MCU) | `references/imu-hardware.md` | BNO085, MPU-9250, ESP32, wiring, power, PCB |
| Suit Design & Fabrication | `references/suit-fabrication.md` | Base layer, sensor pockets, marker placement, harness |
| Firmware & Sensor Fusion | `references/firmware-sensor-fusion.md` | SlimeVR firmware, Madgwick/Mahony, calibration, WiFi |
| Optical Mocap (DIY) | `references/optical-mocap.md` | IR cameras, markers, FreeMoCap, iPi Soft, camera layout |
| Software & Pipeline | `references/software-pipeline.md` | SlimeVR server, FreeMoCap, Blender, Unreal, BVH, retargeting |
| Troubleshooting | `references/troubleshooting.md` | Drift, jitter, occlusion, sync, common errors |

---

## Quick Reference — IMU vs Optical

| | IMU (Inertial) | Optical (Marker-Based) |
|--|---------------|----------------------|
| **Best for** | Portable, outdoor, budget builds | Studio, precision, professional quality |
| **Cameras needed** | None | 6–12+ IR cameras |
| **Position accuracy** | Rotation only (no absolute position) | Full 6DOF position + rotation |
| **Occlusion** | Not affected | Markers must be visible to cameras |
| **DIY cost** | $150–$600 | $500–$3,000+ |
| **Best software** | SlimeVR | FreeMoCap, iPi Soft, Brekel |
| **Output** | BVH, FBX via SteamVR/Blender | BVH, FBX, C3D |
| **Start here** | BNO085 + ESP32 + SlimeVR | FreeMoCap + webcams |

---

## Quick Reference — Sensor Placement (Full Body, 17 sensors)

```
HEAD ──────────── 1 sensor (forehead or back of head)
CHEST ─────────── 1 sensor (sternum)
HIPS ──────────── 1 sensor (sacrum / lower back) ← most important
UPPER ARMS ─────── 2 sensors (left/right)
LOWER ARMS ─────── 2 sensors (left/right)
UPPER LEGS ─────── 2 sensors (left/right thigh)
LOWER LEGS ─────── 2 sensors (left/right shin)
FEET ──────────── 2 sensors (top of foot)
HANDS ─────────── 2 sensors (back of hand) ← optional for basic
SHOULDERS ─────── 2 sensors (optional, improves arm accuracy)
```

**Minimum viable (6 sensors — lower body + hips for VR/walk cycles):**
Hips + 2× upper legs + 2× lower legs + chest

---

## Quick Reference — Output Formats

| Format | Description | Use In |
|--------|-------------|--------|
| BVH | Biovision Hierarchy — skeleton + animation curves | Blender, Maya, MotionBuilder |
| FBX | Autodesk interchange — geometry + animation | Unreal, Unity, Maya |
| C3D | Marker trajectory data (optical) | Vicon, scientific analysis |
| VMD | MikuMikuDance format | MMD, some Blender pipelines |

---

## Recommended Starting Point

**SlimeVR IMU build** is the fastest path to a working DIY suit:
1. Order BNO085 breakout boards + ESP32 + LiPo batteries
2. Flash SlimeVR firmware (pre-built binaries available)
3. Install SlimeVR Server on PC
4. Calibrate and stream to SteamVR or direct to Blender

Full docs: `docs.slimevr.dev` | Community: SlimeVR Discord
