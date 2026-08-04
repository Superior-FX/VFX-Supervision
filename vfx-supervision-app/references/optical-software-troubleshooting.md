# Optical Motion Capture Reference (DIY)

## Camera Setup

### Minimum Camera Count
- **4 cameras**: basic full-body capture with significant occlusion gaps
- **6 cameras**: workable full-body; recommended minimum
- **8–12 cameras**: robust; handles occlusion well

### Camera Placement Principles
- Arrange cameras in a **ring around the capture volume** at 45° above eye level
- Aim cameras at the **center of the capture volume**
- Minimize gaps — each point on the body should be visible to at least 2 cameras
- Typical capture volume for 6 cameras: ~3m × 3m × 2.5m

### Camera Layout (6-Camera Ring)
```
        CAM 2
    CAM 1   CAM 3
       ╔═══╗
       ║ X ║  ← capture volume center
       ╚═══╝
    CAM 6   CAM 4
        CAM 5
Cameras evenly spaced, 60° apart, ~2.5–3m radius
```

### Recommended Cameras
| Camera | Resolution | Notes |
|--------|-----------|-------|
| PS3 Eye | 640×480 | Cheapest ($10 used); IR modification easy; iPi Soft compatible |
| Logitech C920 | 1080p | Better quality; FreeMoCap native support |
| Xbox Kinect v2 | Depth camera | Different approach (depth-based); Brekel compatible |

### IR Modification (PS3 Eye / Webcam)
1. Remove the lens assembly carefully
2. Remove the hot-mirror filter (small glass piece blocking IR)
3. Cut an 850nm bandpass filter to size; insert in place of hot-mirror
4. Reassemble
5. Add IR LED ring around the lens (12–24 LEDs, 850nm) powered via USB
Result: camera sees IR-illuminated reflective markers clearly in low-light conditions

---

# FreeMoCap (Open Source Optical Mocap)

FreeMoCap is the recommended free optical mocap solution for DIY builds.

## What FreeMoCap Does
- Uses standard webcams (no IR modification needed for basic use)
- Employs MediaPipe pose estimation + multi-camera triangulation
- Outputs 3D joint positions
- Generates BVH and can export to Blender directly

## Setup
```bash
pip install freemocap
python -m freemocap
```
Web interface opens at `http://localhost:8080`

## Workflow
1. Mount cameras in ring formation
2. **Calibrate**: show a ChArUco board to all cameras simultaneously
3. **Record**: perform capture session
4. **Process**: FreeMoCap triangulates 3D positions from 2D pose estimates
5. **Export**: BVH or direct Blender scene

## Blender Integration
- FreeMoCap Blender addon: `github.com/freemocap/freemocap_blender_addon`
- Imports skeleton and animation data directly into Blender
- Auto-generates armature with keyframes

---

# Software & Pipeline Reference

## SlimeVR Server

The SlimeVR Server receives data from ESP32 trackers and solves the skeleton.

### Installation
Download from `github.com/SlimeVR/SlimeVR-Server/releases`
Requires Java 17+ (`winget install Microsoft.OpenJDK.17` on Windows)

### Workflow
1. Launch SlimeVR Server
2. Turn on all ESP32 trackers (they auto-connect)
3. Assign trackers to body parts (drag-and-drop in the UI)
4. Calibrate (T-pose reset + ankle calibration)
5. Stream to SteamVR (VR use) or record BVH

### BVH Recording
- SlimeVR Server has built-in BVH recording
- Start recording → perform motion → stop → saves `.bvh` file
- Import BVH into Blender for animation work

---

## Blender Mocap Pipeline

### Importing BVH
1. `File → Import → BVH (.bvh)`
2. Scale: set to 0.01 (BVH often exports in cm; Blender works in meters)
3. Auto Bone Orientation: enable
4. Result: armature object with baked animation keyframes

### Retargeting to a Character Rig
Retargeting maps the captured skeleton onto your character's rig.

**Method 1: Rokoko Blender Plugin (Free + Paid)**
- `extensions.blender.org` — search "Rokoko Studio Live Link"
- Retargeting tool built-in; maps bone names between skeletons
- Works with Mixamo, Rigify, custom rigs

**Method 2: Blender's Built-in Action Constraint**
1. Select character rig
2. For each bone: add `Copy Rotation` constraint
3. Target: mocap armature, subtarget: corresponding bone
4. Bake the action: `Pose → Animation → Bake Action`

**Method 3: Auto-Rig Pro (Paid, $40)**
- Most robust retargeting in Blender
- Handles skeleton scale, orientation, and bone mapping automatically

### Cleaning Mocap Data in Blender
Raw mocap is always noisy — needs cleanup:

1. **Smooth curves**: Select all bones → Graph Editor → `Key → Smooth Keys`
2. **Fix foot skating**: Use "Foot Roll" control or manually keyframe foot positions
3. **Remove jitter**: Apply a `Smooth` modifier to F-Curves
4. **Fill gaps**: Interpolate between good keyframes over problem frames

---

## Unreal Engine Mocap Pipeline

### Live Link (Real-Time Streaming from SlimeVR)
SlimeVR can stream live to Unreal via a community plugin.
- Plugin: `SlimeVR Live Link` (search Unreal Marketplace or GitHub)
- Enables real-time character driving in Unreal Engine 5

### BVH Import to Unreal
1. Convert BVH to FBX first (Blender: import BVH → export FBX with animation)
2. Import FBX in Unreal: `Import → FBX`
3. Set skeleton to your character's skeleton
4. Apply animation sequence to character blueprint

### IKRig Retargeting (Unreal Engine 5)
1. Create IKRig for source skeleton (mocap rig)
2. Create IKRig for target skeleton (character)
3. Create IKRetargeter linking both
4. Bake retargeted animation

---

## BVH Format Reference

BVH (Biovision Hierarchy) is the universal skeleton animation format for mocap.

### File Structure
```
HIERARCHY
ROOT Hips
{
  OFFSET 0.00 0.00 0.00
  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
  JOINT Spine
  {
    OFFSET 0.00 5.21 0.00
    CHANNELS 3 Zrotation Xrotation Yrotation
    ...
  }
}
MOTION
Frames: 300
Frame Time: 0.0333333   ← 30fps
0.00 95.12 0.00 0.12 -1.23 0.45 ...  ← one frame per line
```

### Key Parameters
- **Frame Time**: `1/fps` — e.g., `0.041667` for 24fps, `0.033333` for 30fps
- **CHANNELS 6** on root: 3 position + 3 rotation (root moves in space)
- **CHANNELS 3** on all other joints: rotation only (position derived from hierarchy)
- **Rotation order**: ZXY is most common; confirm when importing

---

# Troubleshooting Reference

## IMU / SlimeVR Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Sensor not detected | Wiring error or wrong I2C address | Check SDA/SCL connections; verify ADDR pin |
| Yaw drift (slow rotation) | No magnetometer or magnetic interference | Use BNO085 ARVR mode; move away from motors/metal |
| Sensor jumps/spikes | WiFi packet loss | Dedicated router; reduce distance to router |
| Foot skating | Ankle calibration not done | Redo ankle calibration standing flat |
| Arm/leg axes wrong | Mounting orientation wrong | Adjust `IMU_ROTATION` in firmware |
| Sensor disconnects mid-session | Weak WiFi or power issue | Check battery level; improve WiFi signal |
| T-pose reset doesn't hold | Sensor shifting on suit | Tighten straps; add anti-rotation strap |
| Position drift accumulates | IMU drift (expected) | Perform periodic resets; use 6-point BNO085 calibration |

## Optical / FreeMoCap Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Cameras not detected | USB bandwidth limit | Use PCIe USB cards; max 2 USB cameras per USB controller |
| Poor tracking | Insufficient lighting | Add diffuse ambient lighting; avoid backlighting |
| Jittery markers | Camera resolution too low or motion blur | Increase shutter speed; upgrade cameras |
| Calibration fails | ChArUco board not visible to all cameras | Larger board; slower movements during calibration |
| Marker swaps (two markers switch IDs) | Markers too close together | Increase marker separation; add more cameras |
| Occluded limbs | Too few cameras | Add cameras on opposite sides |

## General Animation Pipeline Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| BVH imports at wrong scale | BVH in cm, Blender in meters | Import with scale 0.01 |
| Character deforms incorrectly | Skeleton mismatch | Re-run retargeting with correct bone mapping |
| Foot slides on ground | No ground contact constraint | Add IK foot constraints in Blender |
| Motion looks mechanical | Over-smoothed curves | Reduce smoothing; preserve natural acceleration |
| Exported FBX has no animation | Wrong export settings | Check "Bake Animation" in FBX export dialog |
