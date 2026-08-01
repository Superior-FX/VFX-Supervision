# Nuke Workflow Reference

## Table of Contents
1. [Project Setup & Best Practices](#project-setup--best-practices)
2. [Node Graph Organization](#node-graph-organization)
3. [Colorspace Management in Nuke](#colorspace-management-in-nuke)
4. [Multi-Layer EXR & AOV Compositing](#multi-layer-exr--aov-compositing)
5. [Keying Workflows](#keying-workflows)
6. [Roto & Rotopaint](#roto--rotopaint)
7. [3D Compositing & Camera Projection](#3d-compositing--camera-projection)
8. [Deep Compositing](#deep-compositing)
9. [Python Scripting & Gizmos](#python-scripting--gizmos)
10. [Nuke Studio / Hiero Conform](#nuke-studio--hiero-conform)
11. [Render Farm Integration](#render-farm-integration)
12. [Performance Optimization](#performance-optimization)

---

## Project Setup & Best Practices

### Project Settings (First Thing Every Script)
```
Project Settings → Color Management:
  - Color management: OCIO (never "Nuke native" for VFX work)
  - OCIO config: Point to project config or set via $OCIO env var
  - Working space: linear / scene_linear (ACEScg)
  - Viewer: Set to your display transform (e.g., ACES Rec.709)

Project Settings → General:
  - Full-size format: Match deliverable resolution (e.g., 4096×2160 for 4K)
  - Proxy format: Working resolution (e.g., 2048×1080 for 2K proxy)
  - FPS: Match camera / deliverable (e.g., 23.976)
  - Frame range: Handle-in through handle-out
```

### Script File Structure
- Save scripts to: `/project/comp/SC###_###/SC###_###_v001.nk`
- **Never overwrite** — always save incremental versions
- Use `.autosave` Nuke setting to prevent data loss
- Keep related scripts in the same scene folder

### Essential Settings Checklist
- [ ] OCIO config path confirmed
- [ ] Working colorspace = scene-linear
- [ ] Viewer transform set to correct display
- [ ] Resolution and FPS match deliverable spec
- [ ] All Read nodes set to correct colorspace (not Raw)
- [ ] Write node colorspace and format confirmed

---

## Node Graph Organization

### Layout Principles
- **Top-to-bottom flow** — inputs at top, output at bottom
- **Left-to-right** for parallel streams that merge
- **Backdrop nodes** to group and label major sections
- **Dot nodes** to route long connections cleanly (no crossing wires)
- **Disable/enable toggle** nodes rather than delete — easier to A/B compare

### Recommended Backdrops (Color-Code by Function)
| Backdrop Color | Section |
|---------------|---------|
| Dark blue | Plate input / Read nodes |
| Dark green | Roto / matte work |
| Dark purple | CG / 3D elements |
| Dark orange | Color correction |
| Dark red | Key / extract |
| Dark grey | Output / Write nodes |

### Node Groups
- Encapsulate repeating logic into **Group** nodes
- For reusable tools, promote to **Gizmo** (see Python/Gizmos section)
- Group nodes for: despill rigs, grain addition, lens distortion, noise reduction

### Naming Conventions
- Rename nodes to describe their function: `BG_PlateRead`, `FG_Roto_Window`, `CG_Beauty`
- Use **Note nodes** to document unusual approaches or known issues
- Label Merge nodes: `Merge_CG_over_BG`, `Merge_FX_screen`

---

## Colorspace Management in Nuke

### Read Node Colorspace
Every Read node must have the correct colorspace set. **Raw is wrong** for camera footage.

| Footage Type | Read Node Colorspace |
|-------------|---------------------|
| ARRI LogC4 (ALEXA 35) | Input - ARRI - Alexa - LogC4 - Wide Gamut 4 |
| ARRI LogC3 (Mini LF, etc.) | Input - ARRI - Alexa - LogC3 - Wide Gamut 3 |
| RED IPP2 | Input - RED - REDWideGamutRGB - Log3G10 |
| Sony S-Log3/S-Gamut3.Cine | Input - Sony - S-Gamut3.Cine - S-Log3 |
| CG render (ACEScg linear) | ACES - ACEScg |
| CG render (linear) | linear |
| Data (STmap, motion vectors) | Raw |
| Matte / alpha | Raw |

### OCIOColorSpace Node
Use to explicitly convert between colorspaces mid-graph:
- Input colorspace: what the data currently is
- Output colorspace: what you need for the next operation
- **All comp math must happen in scene-linear** — convert before any Merge, Blur, etc.

### Viewer Setup
```
Viewer → LUT → OCIO:
  - Colorspace: scene_linear (ACEScg)
  - Display: Your monitor type (e.g., sRGB, Rec.709, P3-D65)
  - View: ACES RRT + ODT
```
Use the `V` key to toggle viewer process on/off to check linear values.

### Write Node Colorspace
| Deliverable | Write Colorspace | Format |
|-------------|-----------------|--------|
| VFX finals to DI | ACES - ACEScg | EXR 16-bit half, ZIP |
| Precomp / pass-through | Same as input | EXR 16-bit |
| Proxy review | Output - Rec.709 (display) | ProRes 422 or H.264 |
| Data pass | Raw | EXR |

---

## Multi-Layer EXR & AOV Compositing

### Reading Multi-Layer EXR
1. **Read node** → reads the multi-layer EXR (shows as RGBA by default = beauty)
2. **Shuffle node** → extract individual passes:
   - Set `in1` to the layer you want (e.g., `diffuse`, `specular`, `depth`)
   - Output will be the extracted pass in RGBA channels

### Shuffle2 Node (Nuke 12+)
Preferred over Shuffle for flexibility:
- Multiple inputs; drag-and-drop channel mapping
- Easier to build complex channel combos

### Standard AOV Comp Structure
```
[Beauty Read] → [Grade]
[CG Multi-layer EXR]
  → Shuffle (diffuse) → Grade (color correct)
  → Shuffle (specular) → Grade
  → Shuffle (reflection) → Grade
  → Shuffle (emission) → Grade
  → Shuffle (shadow) → used as multiply on BG
  → Shuffle (depth) → ZDefocus or ZMerge
→ CopyBBox / Merge (combine corrected passes)
→ Merge (over) onto BG plate
```

### Deep EXR (Deep Compositing)
- Deep files store multiple depth samples per pixel — correct occlusion without mattes
- Read with **DeepRead** node; process with Deep nodes
- **DeepMerge** — composites multiple deep images correctly by depth
- **DeepToImage** — flatten deep to regular image for final output
- Deep is essential for: smoke/particles over complex geometry, accurate holdouts

---

## Keying Workflows

### Keying Node Comparison
| Node | Best For | Notes |
|------|---------|-------|
| **Keylight** | General greenscreen/bluescreen | Gold standard; excellent edge handling |
| **IBKColour + IBKGizmo** | Difficult screens, uneven lighting | Two-node system; models screen illumination |
| **Primatte** | Alternative to Keylight | Different algorithm; try when Keylight struggles |
| **HueKeyer** | Clean, simple keys | Limited; best for near-perfect conditions |

### Keylight Workflow
1. Sample screen color with the color picker (avoid edge pixels)
2. Set **Screen Matte** controls:
   - Clip Black: lift to remove gray in BG of matte
   - Clip White: pull down to consolidate FG matte
   - Screen Pre-blur: soften spill pickup on fine detail
3. Use **Screen Matte Blur** sparingly — adds softness to edges
4. **Replace Method:** Source for transparent areas; Hard Colour for complete BG removal
5. **Garbage Matte** (Roto): mask off rig, stands, edge of screen — connect to `Outside Mask`
6. **Core Matte** (Roto): fill areas that should be 100% opaque — connect to `Inside Mask`

### Despill Workflow
After keying, spill from the screen contaminates the subject (green cast on skin/hair).
- **HueCorrect** node: desaturate the screen channel in shadow/midtone
- **Despill Gizmo** (studio-specific): many facilities have proprietary despill rigs
- Sample the actual spill from the footage — don't use default settings
- Check despill on grey cards and skin tones especially

### Edge Treatment
- **Dilate/Erode** → expand or contract the matte edge
- **FilterErode** → softer expansion/contraction
- **EdgeBlur / Blur** → soften matte edges for fine detail
- **ZMatte** → uses depth information to assist keying

---

## Roto & Rotopaint

### Roto Node
- Creates vector shapes (Bezier, B-Spline, Ellipse, Rectangle)
- Each shape can be animated per-frame or with keyframes
- Use **Transform handles** to offset, scale, and rotate shapes
- Set **feather** per-shape for soft edges

### Workflow Best Practices
- Work at **full resolution** — proxy roto requires refinement at full res
- Animate the **overall layer transform** before adjusting individual points
  (reduces keyframes; easier to manage motion)
- Use **RotoPaint** for frame-by-frame cleanup (wire removal, rig removal, skin smoothing)
- Split complex subjects into multiple Roto nodes by part (body, hands, hair separately)

### RotoPaint
- Combines roto with paint tools: Clone, Reveal, Dodge, Burn, Blur, Sharpen
- **Clone tool**: copies from another frame or area; use for clean plate integration
- **Reveal tool**: reveals underlying layer
- Paint strokes are non-destructive and animatable

### GPU Acceleration
Enable Nuke GPU acceleration for Roto — significant speed improvement on complex shapes.

---

## 3D Compositing & Camera Projection

### 3D Scene Nodes
| Node | Function |
|------|---------|
| Camera | Define 3D camera; import from matchmove (FBX/Alembic/Nuke script) |
| Scene | Combine all 3D elements |
| ScanlineRender | Render the 3D scene to 2D for compositing |
| Card3D | Project 2D image onto a 3D plane |
| Cube3D / Sphere3D | Simple geometry for projection |
| ReadGeo | Import OBJ, FBX, Alembic geometry |

### Camera Projection Workflow
1. Import matchmove camera (FBX or Nuke camera from 3DEqualizer/SynthEyes)
2. Create **Card3D** (or import geometry for complex shapes)
3. Connect a **Project3D** node: camera in = matchmove camera; image in = background plate
4. Apply to card: **Shader3D** or **ApplyMaterial**
5. Render with **ScanlineRender**
6. Result: background plate "sticks" to 3D space for camera moves

**Use cases:** Set extensions, sky replacements, matte paintings locked to camera

### Camera Data Import Formats
| Format | Source | Notes |
|--------|--------|-------|
| `.nk` snippet | 3DEqualizer, SynthEyes export | Native Nuke camera nodes |
| `.fbx` | Maya, Houdini, any 3D app | Import via ReadGeo / Camera node |
| `.abc` (Alembic) | Any 3D app | Supports animated cameras; use ReadGeo |
| `.chan` | Simple channel data | Tab-separated transform values |

---

## Python Scripting & Gizmos

### Essential Python Operations
```python
# Get selected node
node = nuke.selectedNode()

# Create a node
blur = nuke.createNode("Blur")

# Set a knob value
blur['size'].setValue(5)

# Iterate over all nodes of a type
for r in nuke.allNodes("Read"):
    print(r['file'].value())

# Run script on all write nodes
for w in nuke.allNodes("Write"):
    nuke.execute(w, nuke.frame(), nuke.frame())
```

### Useful Automation Scripts
- **Batch read node colorspace setter** — set colorspace on all reads at once
- **Version bumper** — increment version number in all write node paths
- **Deadline submitter** — submit current script to render farm
- **Turnover importer** — read shot list CSV and create Read nodes for all plates

### Creating a Gizmo
1. Build the node network inside a Group node
2. Expose knobs via `Group → Edit Group → Add Knob`
3. Save Group as `.gizmo` to your `~/.nuke/` or pipeline gizmo path
4. Gizmos appear in the node menu after reload

### Pipeline Integration
- Studios maintain a Python `init.py` / `menu.py` in `~/.nuke/` or pipeline path:
  - `init.py`: executed at Nuke startup; good for environment setup, plugin paths
  - `menu.py`: builds custom menus and toolbars; good for Gizmos, scripts
- Use `nuke.pluginAddPath()` to add custom gizmo/script directories

---

## Nuke Studio / Hiero Conform

**Nuke Studio** = Nuke + Hiero (timeline/conform) in one application.

### Key Workflows
- **Conform**: Match editorial AAF/EDL to full-res media; build a timeline of plates
- **VFX Round-trip**: Export plates from timeline → comp in Nuke → re-import finals to timeline
- **Versioning**: Track multiple versions of each shot in the timeline

### Conform Process
1. Import AAF or EDL (from editorial Avid/Premiere)
2. Reconnect media: point Hiero at your full-res plates directory
3. Review: compare each clip to the reference cut for accuracy
4. Export using **Shot Processor**: creates per-shot Nuke comp scripts with Read/Write nodes
   pre-configured to the correct frame range and handles

---

## Render Farm Integration

### Common Farm Managers
- **Deadline (Thinkbox/AWS)** — most widely used; extensive plugin support
- **Tractor (Pixar)** — common in VFX facilities with Pixar pipelines
- **OpenCue (Google/ASWF)** — open-source; growing adoption

### Deadline Nuke Submission
- Use the **Deadline Monitor** client or submit from within Nuke (plugin)
- Specify: frame range, chunk size, pool, machine limit, output path
- Use **dependency jobs** to chain: render CG → composite → review transcode

### Farm Optimization
- **Chunk size**: typically 1–5 frames per task; balances overhead vs. parallelism
- For slow Nuke scripts: use **Continue on Error** for frame sequences to avoid one bad frame killing the whole job
- Check **Write node paths** are on network storage accessible by all farm nodes
- `/tmp` local paths will fail on farm — always use shared storage paths

---

## Performance Optimization

### Proxies
- Work at **1/2 or 1/4 proxy** during creative work; switch to full for final renders
- Set proxy format in Project Settings
- Use **Proxy Mode** toggle (Shift+P) for quick switch

### Caching
- `Cache → Clear Disk Cache` when switching shots (prevents memory leaks)
- Increase RAM cache allocation in Preferences if you have RAM to spare
- For complex scripts: add **DiskCache** nodes at expensive intermediate points

### GPU Acceleration
- Enable in Preferences → Performance → GPU
- Most useful for: Blur, denoise, grain, keying, 3D rendering
- Requires compatible GPU with sufficient VRAM

### Script Optimization
- Avoid unnecessary **Merge nodes** in the middle of a processing chain — they create copies
- Use **PrecompNode** or write/read caches for expensive sub-networks used multiple times
- **Disable** nodes not currently needed (D key) — unneeded nodes still consume memory in some cases
