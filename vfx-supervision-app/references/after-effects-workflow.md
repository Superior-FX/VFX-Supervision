# After Effects Workflow Reference

## Table of Contents
1. [Project Setup & Color Management](#project-setup--color-management)
2. [OCIO in After Effects](#ocio-in-after-effects)
3. [Composition Best Practices](#composition-best-practices)
4. [3D Integration & Camera Data](#3d-integration--camera-data)
5. [Expressions & Scripting](#expressions--scripting)
6. [Key Plugins for VFX](#key-plugins-for-vfx)
7. [Motion Tracking & Stabilization](#motion-tracking--stabilization)
8. [Media Encoder & Output Templates](#media-encoder--output-templates)
9. [Dynamic Link & Premiere Integration](#dynamic-link--premiere-integration)
10. [AE in a VFX Pipeline](#ae-in-a-vfx-pipeline)

---

## Project Setup & Color Management

### Project Settings — Critical for VFX

```
File → Project Settings → Color Settings:
  - Depth: 32 bits per channel (float) — required for linear/HDR work
  - Working Color Space: sRGB (for web/motion graphics) or none (use OCIO)
  - Linearize Working Space: check if using linear workflow without OCIO
  
  For VFX / ACES pipeline:
  - Use OCIO plugin (see OCIO section) rather than native AE color management
  - Set bit depth to 32 bpc regardless
```

### Bit Depth
- **8 bpc** — avoid for VFX; banding and limited range
- **16 bpc** — acceptable for most motion graphics; not for CG/linear compositing
- **32 bpc** — required for linear/scene-linear compositing, HDR, CG integration

Toggle bit depth: `Alt+click` (Win) / `Option+click` (Mac) on the color depth indicator
in the Project panel.

### Frame Rate
Set composition frame rate to match your deliverable — do not rely on AE's playback
speed adjustment to "fix" a wrong frame rate. Wrong FPS = wrong motion blur.

---

## OCIO in After Effects

After Effects does not natively support OCIO in the same way Nuke does, but there are
two main approaches:

### Approach 1: OCIO Plugin (Fnordware aeOCIO or similar)
- **aeOCIO** (free, third-party) — apply OCIO transforms as an effect
- Apply as an effect layer to input footage:
  - Input colorspace: camera log (e.g., LogC3)
  - Output colorspace: ACEScg or scene linear
- Apply as a final effect to output: scene-linear → Rec.709 ODT
- **Limitation:** Must manually manage OCIO transforms on every layer

### Approach 2: Convert Plates Before AE
1. Convert plates to **linear EXR** (ACEScg) using Nuke, Resolve, or OCIO command-line tools
2. Import linear EXR into AE
3. Work in 32-bpc with AE's native linear blending
4. Output as linear EXR and apply final display transform outside AE

### Approach 3: AE Native Linear Workflow (Simpler pipelines)
1. Import log footage
2. Set the `Interpret Footage → Color Profile` to a suitable ICC profile (limited options)
3. Enable `Linearize Working Space` in Project Settings
4. Enable `Blend Colors Using 1.0 Gamma` (NOT enabled for true linear work)
- **Limitation:** No true ACES support; limited camera colorspace handling

### Viewer Calibration
- AE's viewer is display-referred by default — it applies the working color space output
- For VFX work, ensure your display profile is calibrated or use the OCIO approach
- Check `View → Use Display Color Management` — enable for calibrated monitor workflows

---

## Composition Best Practices

### Layer Stack Logic
AE compositing is **layer-based** (unlike Nuke's node-based). Layers on top occlude layers below.

```
[Adjustment Layer: output color correction + display transform]
[FG Element with alpha]
[CG Layer]
[Plate (BG)]
```

### Pre-composing
- Use **Pre-comp** to group related layers (equivalent to Nuke Groups)
- Pre-comp settings: `Move All Attributes` = maintains all effects and transforms
- Use pre-comps for: keyed elements, particle systems, screen replacement layers

### Blending Modes for VFX
| Mode | Use Case |
|------|---------|
| Normal | Standard comp over alpha |
| Screen | Additive fire, sparks, lens flares, light leaks |
| Multiply | Shadows, dirt, darkening overlays |
| Add | Glows, bloom, neon lights |
| Overlay | Color grading passes |
| Luminosity | Shine passes without color shift |

### Track Mattes
AE Track Mattes are the primary masking system:
- **Alpha Matte** — layer above defines mask by its alpha channel
- **Luma Matte** — layer above defines mask by luminance
- Essential for: keyed elements, hold-out mattes, screen replacement

### Shape Layers vs. Masks
- **Masks** (on a layer) — traditional AE masking; attached to a specific layer
- **Shape Layers** — standalone vector shapes; more flexible; supports path animation
- For VFX roto: masks on a Solid layer, then use as track matte; or use dedicated roto tools

---

## 3D Integration & Camera Data

### AE's 3D Coordinate System
- **Z-axis** points toward the viewer (out of screen)
- Camera works in millimeters by default; adjust zoom to match lens focal length
- Enable 3D on layers to place them in 3D space

### Importing Camera Data
| Source | Import Method |
|--------|-------------|
| Mocha Pro | Export AE camera data directly |
| 3DEqualizer | Export AE script (.jsx) |
| After Effects tracker | Built-in 3D camera solve |
| FBX | Requires third-party plugin (Overlord, etc.) or Cineware |
| Element 3D | Native 3D within AE |

### AE's 3D Camera Tracker (Built-in)
1. Apply to footage layer: `Animation → Track Camera`
2. AE analyzes footage and creates track points
3. Select 3+ coplanar points → right-click → Create Camera + Null + Plane
4. **Limitation:** No lens distortion model; poor for anamorphic; not suitable for complex VFX work
5. **Use for:** Simple screen replacements, surface attachments, casual 3D integration
6. **Use Mocha Pro / 3DE for:** Any production VFX tracking

### Mocha Pro Integration
Mocha Pro (from Boris FX) is the industry standard planar tracker in AE:
- **Planar tracking** for screens, surfaces, organic shapes
- Export: AE Corner Pin, Transform, Roto data, Remove (object removal)
- Run as a standalone or as an AE plugin effect
- Preferred over AE's built-in tracker for any production work

---

## Expressions & Scripting

### Expressions Basics
AE expressions use **JavaScript (ExtendScript)** syntax.

Common expressions:
```javascript
// Link to another layer's property
thisComp.layer("Null 1").transform.position

// Wiggle (random motion)
wiggle(2, 30) // frequency, amplitude

// Loop (ping-pong, cycle, continue)
loopOut("cycle")

// Time offset (delay)
delay = 10; // frames
timeToFrames(time) - delay

// Convert slider to rotation
linear(effect("Slider Control")("Slider"), 0, 100, 0, 360)
```

### Scripting (JSX)
Run `.jsx` scripts via `File → Scripts → Run Script File`:
```javascript
// Create a new composition
var comp = app.project.items.addComp("MyComp", 1920, 1080, 1, 10, 24);

// Loop through all layers in active comp
var comp = app.project.activeItem;
for (var i = 1; i <= comp.numLayers; i++) {
    var layer = comp.layer(i);
    $.writeln(layer.name);
}
```

### Useful Scripts (Free/Paid)
- **rd_scripts** (free) — extensive utility scripts for AE
- **Flow** (AEJuice) — easing curve editor for animations
- **Overlord** (Battle Axe) — paste Illustrator/Photoshop paths as shape layers
- **aescripts + aeplugins** — largest AE script marketplace

---

## Key Plugins for VFX

### Tracking & Stabilization
| Plugin | Function |
|--------|---------|
| **Mocha Pro** (Boris FX) | Planar tracking, roto, remove, stabilize |
| **SynthEyes** | External 3D tracking; exports AE scripts |
| **RE:Vision ReelSmart Motion Blur** | Accurate motion blur on VFX elements |

### Keying
| Plugin | Function |
|--------|---------|
| **Primatte Keyer** (Boris FX) | Alternative to Keylight |
| **BCC Chroma Key Studio** | Integrated keying/despill toolset |
| **Keylight** (built-in via AE) | Standard greenscreen/bluescreen key |

### VFX & Compositing
| Plugin | Function |
|--------|---------|
| **Element 3D** (Video Copilot) | 3D objects in AE without 3D app |
| **Optical Flares** (Video Copilot) | Lens flare system |
| **Particular** (Trapcode) | 3D particle system |
| **Form** (Trapcode) | Grid/mesh-based particle system |
| **Mir 3** (Trapcode) | 3D polygon mesh generator |
| **Starglow** (Trapcode) | Star-shaped glow/bloom |
| **RSMB** (RE:Vision) | Motion blur on composited elements |
| **Neat Video** | Noise reduction on plates |

### Color & Finishing
| Plugin | Function |
|--------|---------|
| **Magic Bullet Looks** | Color grading suite |
| **Colorista V** | Professional color correction in AE |
| **Film Riot Looks** | Film emulation |

---

## Motion Tracking & Stabilization

### Built-in Tracker (Simple Use Cases Only)
1. `Window → Tracker` panel
2. Select layer → `Track Motion`
3. Set track type: Position, Rotation, Scale, or Perspective
4. Adjust track region and search region per track point
5. Analyze forward/backward
6. Apply to target layer or null

### Warp Stabilizer VFX (Built-in)
- Apply as an effect to shaky footage
- **Smooth Motion**: reduces shake while preserving camera movement
- **No Motion**: locks the camera completely (requires significant crop)
- **Detailed Analysis**: higher quality but slower
- **Preserve Scale**: prevents Warp Stabilizer from scaling/zooming to fill frame

### Mocha Pro Workflow in AE
1. Apply Mocha Pro effect to layer
2. Click "Launch Mocha" to open Mocha interface
3. Track the surface using planar tracking
4. In Mocha: File → Export Tracking Data → AE Corner Pin
5. Paste data into AE: creates a Corner Pin effect with keyframes

---

## Media Encoder & Output Templates

### Setting Up Output Templates
`Edit → Templates → Output File Destinations and Templates`

**Key Presets to Create:**
| Name | Codec | Settings |
|------|-------|---------|
| VFX Review H.264 | H.264 | 1080p or 4K, VBR 2-pass, 20–40 Mbps |
| Dailies ProRes 422 HQ | ProRes 422 HQ | Match comp size/FPS |
| VFX Element ProRes 4444 | ProRes 4444 | Full res, with alpha |
| Broadcast DNxHR HQX | DNxHR HQX | For Avid delivery |

### Render Queue vs. Media Encoder
| Render Queue | Media Encoder |
|-------------|--------------|
| Synchronous — blocks AE | Background — AE stays usable |
| Simpler output settings | More format options |
| EXR sequence output | EXR sequences; more codec options |
| Use for: EXR sequences, quick renders | Use for: H.264, ProRes deliverables |

### EXR Sequence Output from AE
- Render Queue → Output Module → Format: OpenEXR Sequence
- Set: `Channel: RGBA`, `Depth: 32 bits`, `Compression: ZIP (lossless)`
- Name: `[CompName]_####.exr`
- Note: AE EXR output is not multi-layer — each pass requires a separate comp

---

## Dynamic Link & Premiere Integration

### Premiere ↔ AE Dynamic Link
- Right-click a clip in Premiere → `Replace with After Effects Composition`
- AE opens with a new composition containing the Premiere clip
- Changes in AE are live in Premiere (no render required for preview)
- **Final delivery**: render in AE (not via Dynamic Link) for full quality

### Essential Graphics (Motion Graphics Templates)
- Create in AE → save as `.mogrt` file
- Open in Premiere via `Essential Graphics` panel
- Expose specific parameters (text, color, size) for editors to adjust without opening AE
- Used for: lower thirds, title cards, broadcast graphics

### Limitations of Dynamic Link
- Not suitable for heavy VFX shots — Premiere will struggle to preview
- For VFX-heavy shots: render to ProRes/DNxHR from AE, then reimport to Premiere
- Dynamic Link is best for: motion graphics, simple titles, basic color correction

---

## AE in a VFX Pipeline

### When to Use AE vs. Nuke
| Scenario | Preferred Tool |
|---------|--------------|
| Multi-layer CG compositing, complex keys | **Nuke** |
| Motion graphics, titles, broadcast graphics | **After Effects** |
| Screen replacement (simple, planar) | **After Effects** (Mocha) |
| 3D camera projection, deep comp | **Nuke** |
| FX simulations integration | **Nuke** |
| Fast turnaround, simpler shots | **After Effects** |
| Pipeline with EXR multi-layer deliverables | **Nuke** |
| Client direct: Premiere-based post | **After Effects** |

### Delivery from AE to DI
If AE is used for shots going to a DI:
- Deliver as **EXR sequences** (linear, 32-bit)
- Apply a **linear → display** transform only in the viewer, not baked into output
- Confirm colorspace labeling with the DI facility
- Avoid baking any ODT into deliverables — let the colorist apply
