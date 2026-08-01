# CGI / 3D Pipeline Reference

## Table of Contents
1. [VFX Pipeline Overview](#vfx-pipeline-overview)
2. [USD (Universal Scene Description)](#usd-universal-scene-description)
3. [Modeling & Asset Preparation](#modeling--asset-preparation)
4. [Rigging & Animation](#rigging--animation)
5. [Houdini FX](#houdini-fx)
6. [Lighting & Rendering](#lighting--rendering)
7. [AOV / Render Pass Structure](#aov--render-pass-structure)
8. [Texturing Pipeline](#texturing-pipeline)
9. [Naming & Versioning Conventions](#naming--versioning-conventions)
10. [Lighting Reference Usage](#lighting-reference-usage)

---

## VFX Pipeline Overview

### Typical CG Shot Pipeline
```
Script/Brief
  → Concept Art + Design Lock
  → Modeling (hero mesh, proxy mesh)
  → Rigging (if animated character/creature)
  → Texturing (Substance, Mari, Photoshop)
  → Lookdev (material and lighting preview)
  → Animation / Layout (camera + performance)
  → FX (Houdini simulations)
  → Lighting (per-shot, using HDRIs and scene lighting)
  → Rendering (per-pass/AOV)
  → Compositing (Nuke)
  → Review → Revisions → VFX Final
```

### Pipeline Data Flow
- Assets travel as **USD** (preferred) or Alembic (.abc) between departments
- Scene assembly in **USD** or Houdini / Maya
- Renders are per-AOV EXR sequences
- Cache sims as **VDB** (volumes) or Alembic (geometry)

### Key Software by Discipline
| Discipline | Primary | Alternate |
|------------|---------|-----------|
| Modeling | Maya, ZBrush, Houdini | Blender, 3ds Max |
| Rigging | Maya | Houdini KineFX, Blender |
| Animation | Maya | Houdini, Blender, MotionBuilder |
| FX Simulations | **Houdini** | Maya Bifrost, Blender |
| Lighting | Houdini (Karma), Maya (Arnold), Renderman | Blender (Cycles/EEVEE) |
| Texturing | **Substance 3D Painter**, Mari | Photoshop |
| Lookdev | Houdini, Maya, Blender | |
| Compositing | **Nuke** | After Effects |
| Review | RV (Autodesk/ShotGrid) | DaVinci, Resolve |

---

## USD (Universal Scene Description)

USD is the open standard for scene description, interchange, and collaboration in VFX/animation pipelines.

### Why USD Matters
- **Non-destructive composition**: layers (overrides) can be applied without modifying base files
- **Collaboration**: multiple departments can work on the same asset simultaneously
- **Scalability**: handles massive scenes (entire city blocks); reference/instance system
- **Industry adoption**: Disney, Pixar, ILM, Weta, NVIDIA, Apple all use USD

### USD Fundamentals
- **Stage**: the entire scene graph
- **Layer**: a file (`.usda`, `.usdc`, `.usdz`); layered in a stack
- **Prim**: a node in the scene hierarchy (mesh, camera, light, scope)
- **Override**: a sparse layer that modifies only what it specifies
- **Reference / Payload**: load an external USD file into the stage

### USD Layer Stack (Typical)
```
Shot Layer (overrides: camera, shot-specific lighting)
  → Asset Layer (animation cache, lookdev)
    → Base Asset Layer (model, rig, base textures)
```

### File Formats
| Extension | Type | Notes |
|-----------|------|-------|
| `.usda` | ASCII | Human-readable; good for debugging |
| `.usdc` | Binary (Crate) | Compact, fast; production standard |
| `.usdz` | Zip archive | AR/mobile distribution; read-only |
| `.usd` | Either | ABI auto-detects |

### USD in DCC Applications
- **Houdini**: native USD via Solaris; full USD pipeline support
- **Maya**: USD Plugin (open-source); growing support
- **Blender**: USD import/export; less complete than Maya/Houdini
- **Nuke**: USD geometry via ReadGeo (Nuke 14+)

---

## Modeling & Asset Preparation

### Asset Resolution Levels
| Level | Use Case | Notes |
|-------|---------|-------|
| **Hero** | Close-up renders, hero shots | Full detail, high polygon, full UV/textures |
| **Mid** | Medium-distance shots | Reduced polygon; full textures |
| **Proxy** | Animation, layout, simulation | Very low poly; no textures |
| **LOD (Level of Detail)** | Crowd, background | Automated; multiple levels auto-switched |

### Polygon Budgets (Rough Guides)
- Hero creature/character: 500K–3M polygons
- Hero vehicle: 200K–1M polygons
- Background building: 10K–100K polygons (pre-subdivision)
- Use **SubDivision Surfaces** (Catmull-Clark) for hero assets — low-poly cage rendered at higher subdivision

### UV Unwrapping Standards
- No overlapping UVs on hero assets (unless tiling textures)
- UV shells organized by material region (metal, skin, fabric)
- Consistent **texel density** across asset
- 0–1 UV space for primary maps; UDIM tiles (1001, 1002...) for complex assets

### UDIM Workflow
UDIM (U-Dimension) allows textures across multiple UV tiles:
- Tile 1001 = UV quadrant 0–1 × 0–1
- Tile 1002 = UV quadrant 1–2 × 0–1 (shifted right)
- Software support: Substance, Mari, Houdini, Maya
- Allows ultra-high resolution texturing across complex assets

---

## Rigging & Animation

### Rig Types
| Rig | Use Case |
|-----|---------|
| FK (Forward Kinematics) | Tail sweeps, cape flow, non-IK limbs |
| IK (Inverse Kinematics) | Limbs, foot contact, mechanical parts |
| Hybrid FK/IK | Production character rigs (switch per limb) |
| Blend Shape / Morph Target | Facial animation, correctives |
| Muscle System | Skin deformation, jiggle, secondary motion |
| Cloth Sim | Fabric, hair, fur — sim or key-frame |

### Animation Deliverables
- Animators deliver: **Maya scene (.ma) or Alembic cache (.abc)**
- Alembic preferred for inter-DCC transfer (Maya → Houdini → Nuke)
- Include: animated geometry + camera + any simulated elements
- Frame range: full shot duration + handles

### Motion Capture Integration
- Solve in: **MotionBuilder** (industry standard), Vicon Shogun, Xsens
- Clean and retarget in MotionBuilder
- Export: FBX or Alembic to Maya for final refinement
- VFX Supervisor on capture day: confirm tracking marker placement, capture quality, safety

---

## Houdini FX

### Houdini's Role in VFX
Houdini is the standard for **procedural FX** in VFX production:
- Fire, smoke, pyro, clouds → **Pyro solver**
- Water, ocean, waves, splashes → **FLIP/Ripple/Ocean solvers**
- Destruction, breaking, crumbling → **Voronoi/Constraint networks/RBD**
- Cloth, hair, fur → **Vellum solver**
- Crowds → **Crowd solver**
- Particles, sparks → **POP solver**

### Key Houdini Concepts
- **SOP (Surface Operations)**: geometry processing; the core of Houdini modeling/FX
- **DOP (Dynamic Operations)**: simulations; physics-based solvers
- **VEX**: Houdini's C-like expression language; runs in VOPs and wrangles
- **Python SOP**: Python scripting for geometry manipulation
- **PDG/TOPs**: task scheduling; farm submission; batch processing

### Pyro (Fire/Smoke) Workflow
```
Source (Geometry → Pyro Source) 
→ Pyro Solver (temperature, fuel, density, velocity fields)
→ Cache (VDB to disk)
→ Volume Visualization / Karma render
→ Export EXR (emission, density, shadow, combined) to Nuke
```

**Key parameters to tune:**
- `dissipation` — how fast smoke disperses
- `turbulence` — internal chaos of the sim
- `wind / velocity field` — external forces
- `temperature` — drives buoyancy/rise rate

### FLIP Fluid (Water/Liquid) Workflow
```
Fluid Object (source geometry + initial velocity)
→ FLIP Solver
→ Cache particles (.bgeo.sc)
→ Surface meshing (VDB from Particles → Convert VDB)
→ Render as geometry (add displacement for detail)
```

**Common pitfalls:**
- Subsampling: increase for fast-moving fluid (prevents interpenetration)
- Particle separation: controls mesh resolution (smaller = finer but heavier)
- Velocity scale: match to real-world speed scale

### RBD Destruction Workflow
```
Geometry → Voronoi Fracture (or Boolean fracture for hero breaks)
→ RBD Simulation (Bullet solver)
→ Cache transforms (.bgeo.sc or Alembic)
→ Render (instances for non-hero debris)
```

### Vellum (Cloth & Soft Body)
- `Vellum Cloth` — fabric, flags, soft bodies
- `Vellum Hair` — hair, fur, cables, ropes
- `Vellum Constraints` — control stiffness, plasticity, damping
- Much faster than traditional cloth solvers; handles self-collision well

---

## Lighting & Rendering

### Render Engines
| Engine | Notes | Best For |
|--------|-------|---------|
| **Arnold (Autodesk)** | Industry standard for Maya/C4D; unbiased path tracing | Characters, hero shots, VFX |
| **Karma (SideFX)** | Houdini-native; USD-based; XPU (CPU+GPU hybrid) | Houdini FX shots; growing adoption |
| **V-Ray (Chaos)** | Widely used in arch-vis and film; reliable | Environments, product viz |
| **Redshift** | Fast GPU renderer; NVIDIA-optimized | Episodic, fast turnaround |
| **RenderMan (Pixar)** | Academy Award-winning; used at Disney/Pixar | Feature animation |
| **Cycles (Blender)** | Open source; GPU-accelerated; improving quality | Indie, previs, motion graphics |

### Render Settings for VFX
```
Sampling:
  - Camera AA samples: 6–16 (higher for fine detail / motion blur)
  - Diffuse: 4–8
  - Specular: 4–8
  - Transmission: 4–8
  - SSS: 4–8
  - Volume: 4 (increase for volumetrics)

Filtering:
  - Gaussian filter width: 2–3 (sharper); higher = smoother
  - Catmull-Rom: sharper; can increase aliasing

Motion Blur:
  - Match camera shutter angle (180° typical = 0.5 shutter fraction)
  - Use deformation blur for characters/cloth (not just transform blur)
```

### Lighting for CG Integration
Key principle: CG must be lit from the **same illumination** as the plate.
1. Place **HDRI** from on-set capture as the sky light / image-based light (IBL)
2. Add **practical lights** to match key practicals visible in plate
3. Use **light linking** to separate lighting on different elements
4. **Shadow catcher** passes to integrate CG shadows onto practical set
5. **Holdout shaders** for areas where practical elements must show through CG

---

## AOV / Render Pass Structure

### Why AOVs
AOVs (Arbitrary Output Variables) separate the render into components that compositors
can recombine with full control, allowing non-destructive color correction per element.

### Standard AOV Set

| Pass | Description | Usage in Comp |
|------|-------------|--------------|
| `beauty` | Combined final render | Starting point |
| `diffuse_direct` | Direct diffuse lighting | Color correct separately |
| `diffuse_indirect` | GI / indirect diffuse | Adjust bounce light |
| `specular_direct` | Direct specular highlights | Tweak shine |
| `specular_indirect` | Reflections | Adjust reflectivity |
| `transmission` | Refractions, SSS | Control transparency |
| `emission` | Self-illuminating surfaces | Adjust glows |
| `sss` | Sub-surface scattering | Adjust skin/wax |
| `depth` / `Z` | Distance from camera | DOF, fog, ZMerge |
| `normal` | Surface normal vectors | Relighting (ACES LMT) |
| `motion` | Per-pixel velocity | Motion blur in comp |
| `crypto_material` | Material ID masks | Object isolation |
| `crypto_object` | Object ID masks | Object isolation |
| `shadow` | Shadow catcher pass | Composite shadows onto BG |
| `alpha` | Matte for full element | Compositing |
| `holdout` | Areas behind practical | Occlusion by real objects |

### Additive Pass Reconstruction (Verify)
```
beauty ≈ diffuse_direct + diffuse_indirect + specular_direct + specular_indirect 
         + transmission + emission + sss (approximately)
```
This must balance — if it doesn't, check for missing AOVs or double-counted passes.

---

## Texturing Pipeline

### Substance 3D Painter
- Industry standard for PBR (Physically Based Rendering) texturing
- Workflow: import mesh → paint in 3D → export maps
- Output maps: BaseColor, Roughness, Metalness, Normal, Height, Emissive

### Mari
- Preferred for complex characters (skin, creature, aged surfaces)
- Multi-layer painting directly on high-poly mesh
- UDIM workflow standard
- Better suited for detailed organic work than Substance

### PBR Texture Maps
| Map | Bit Depth | Notes |
|-----|-----------|-------|
| BaseColor / Albedo | 8-bit sRGB | No lighting; pure surface color |
| Metalness | 8-bit linear | 0 = dielectric, 1 = metal |
| Roughness | 8-bit linear | 0 = mirror, 1 = fully diffuse |
| Normal | 8-bit or 16-bit linear | Tangent space (default); flip G channel for DX vs OpenGL convention |
| Height / Displacement | 16-bit linear | Geometric displacement |
| Emissive | 8-bit or HDR | Self-illumination; HDR for bright sources |
| Opacity | 8-bit | Transparency mask |

### Texture Resolution
| Asset Type | Resolution |
|-----------|-----------|
| Hero character / creature | 4K–8K per UDIM tile |
| Hero vehicle / prop | 4K per tile |
| Mid-ground asset | 2K–4K |
| Background / crowd | 512–1K |

---

## Naming & Versioning Conventions

### Asset Naming
`[SHOW]_[AssetType]_[AssetName]_[LOD]_[Version].[ext]`

Example: `PROJ_CHAR_AlienCreature_hero_v014.usd`

### Shot File Naming
`[SHOW]_SC[###]_[###]_[Dept]_[Version].[ext]`

Example: `PROJ_SC015_010_FX_Pyro_v003.bgeo.sc`

### Cache Files
- Alembic: `SC015_010_MainChar_anim_v002.abc`
- VDB: `SC015_010_Pyro_density_0001.vdb`
- Nuke Write: `SC015_010_beauty_v025_####.exr`

### Version Control
- All files: start at `v001`; increment every delivery or significant change
- Never overwrite existing versions
- Departments use: **ShotGrid (Autodesk)** or **Ftrack** for official versioning + review
- Local versions: can be more granular; only official deliveries go into tracking system

---

## Lighting Reference Usage

### Using HDRIs in Rendering
1. Load HDRI into render engine as **dome light / IBL**
2. Set intensity to match real-world stop: **match grey ball** from on-set HDRI capture
3. Rotate dome to match sun direction in plate
4. Expose render to match plate: use a grey ball CG sphere in the comp to verify

### Matching CG to Plate Lighting
1. **Color temperature**: match renderer's white balance to the plate's WB
2. **Key/fill ratio**: measure from grey ball HDRI; match in CG
3. **Shadow direction/softness**: match practical shadow size and direction
4. **Color of shadows**: often colored by sky/bounce — match from HDRI

### Lighting Reference From Set
| Reference | What It Tells You |
|-----------|------------------|
| Chrome ball HDRI | Full 360° environment; key light direction and color |
| Grey ball | Softbox placement, fill ratios, diffuse light color |
| Color checker in plate | Exact color calibration reference; verify IDT accuracy |
| Lens flares in plate | Practical light positions and intensities |
| Shadows on set | Key light softness, direction, color |
