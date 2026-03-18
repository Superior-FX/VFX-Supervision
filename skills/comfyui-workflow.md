# ComfyUI / AI-Assisted VFX Reference

## Table of Contents
1. [AI Tools Overview for VFX](#ai-tools-overview-for-vfx)
2. [ComfyUI Setup & Workflow](#comfyui-setup--workflow)
3. [ControlNet for VFX-Aware Generation](#controlnet-for-vfx-aware-generation)
4. [Inpainting for Clean Plates & Removal](#inpainting-for-clean-plates--removal)
5. [AI Roto & Segmentation](#ai-roto--segmentation)
6. [AI Upscaling](#ai-upscaling)
7. [AI Motion & Frame Interpolation](#ai-motion--frame-interpolation)
8. [LoRA Training for Consistent Assets](#lora-training-for-consistent-assets)
9. [Integrating AI Outputs into Nuke/AE Pipeline](#integrating-ai-outputs-into-nukeae-pipeline)
10. [Frame Consistency Techniques](#frame-consistency-techniques)
11. [Limitations & QC Considerations](#limitations--qc-considerations)

---

## AI Tools Overview for VFX

### Current AI Tool Categories in Production
| Category | Tools | VFX Use Case |
|----------|-------|-------------|
| Image generation | ComfyUI + SD, Midjourney, DALL-E 3 | Concept art, texture generation, matte painting base |
| Video generation | Runway Gen-3, Kling, Sora, Pika | Background generation, B-roll, previs |
| Segmentation / Roto | SAM2 (Meta), Runway, DaVinci Neural | AI-assisted rotoscoping |
| Object removal | ComfyUI inpaint, Runway, Nuke AI models | Clean plate generation, rig removal |
| Upscaling | Topaz Video AI, Real-ESRGAN, Magnific | Resolution enhancement, grain matching |
| Depth estimation | Depth Pro (Apple), Marigold, ZoeDepth | Depth maps for 3D-aware compositing |
| Frame interpolation | RIFE, FILM (Google), Topaz | Slow motion, frame rate conversion |
| AI tracking | Mocha Pro AI, Runway | Assisted matchmove, planar tracking |

### Production Readiness
| Tool | Production-Ready? | Notes |
|------|------------------|-------|
| SAM2 segmentation | Yes | High quality; manual cleanup still needed |
| Topaz upscaling | Yes | Widely used in VFX pipelines |
| AI clean plates | Partial | Good for background elements; face/hands still need manual work |
| AI video generation | Previs/concept only | Not yet DI-quality; temporal consistency is main limitation |
| ControlNet + SD inpaint | Partial | Useful with significant artist supervision |

---

## ComfyUI Setup & Workflow

### What is ComfyUI
ComfyUI is a node-based interface for Stable Diffusion and related models. It's the most
pipeline-friendly SD frontend due to its node graph architecture and Python extensibility.

### Installation
```bash
# Prerequisites: Python 3.10+, CUDA GPU (minimum 8GB VRAM for SDXL)
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install -r requirements.txt
python main.py
# Access at http://localhost:8188
```

### Model Locations
```
ComfyUI/
├── models/
│   ├── checkpoints/     # Base models (.safetensors)
│   ├── loras/           # LoRA weights
│   ├── controlnet/      # ControlNet models
│   ├── upscale_models/  # ESRGAN etc.
│   └── vae/             # VAE models
```

### Key Models for VFX
| Model | Use Case |
|-------|---------|
| **SDXL 1.0** | Highest quality general generation |
| **Juggernaut XL** | Photorealistic environments, textures |
| **RealVis XL** | Highly photorealistic outputs |
| **AnimateDiff** | Video / frame-sequence generation |
| **FLUX.1** | High quality; very popular; requires more VRAM |

### Basic ComfyUI VFX Node Structure
```
[Load Image] → [VAE Encode] 
[CLIP Text Encode (positive)] → [KSampler] → [VAE Decode] → [Save Image]
[CLIP Text Encode (negative)] ↗
[Load Checkpoint] → (model, CLIP, VAE outputs)
```

---

## ControlNet for VFX-Aware Generation

ControlNet conditions image generation on structural information extracted from your
comp (depth, normals, edges, pose) — ensuring generated content respects your plate's
geometry and lighting context.

### ControlNet Models for VFX
| ControlNet Type | Extracts From | Best For |
|----------------|--------------|---------|
| **Depth** | Depth map (from ZoeDepth, Depth Pro) | Environment extension matching scene depth |
| **Normal Map** | Normal pass from CG render | CG integration, texture generation |
| **Canny Edge** | Edge-detected plate | Preserving composition structure |
| **HED / MLSD** | Soft edges / line detection | Architecture, set extension |
| **OpenPose** | Skeleton from video | Character posing, costume concept |
| **IP-Adapter** | Reference image | Style/appearance transfer |
| **Inpaint ControlNet** | Masked region + context | Context-aware fill |

### Depth-Guided Environment Extension Workflow
1. Extract depth map from plate using **Depth Pro** or **ZoeDepth**
2. In ComfyUI: Load plate → `ControlNet Preprocessor (Depth)` → feed to ControlNet
3. Generate: describe the extended environment in prompt
4. Mask: only generate the extension area (outside the original frame)
5. Result: generated environment respects depth and perspective of original plate

### Normal Map → Texture Generation
1. Export normal pass from CG render (Houdini, Maya, Blender)
2. Feed normal map as ControlNet condition
3. Prompt for the desired surface material
4. Generated texture will be lighting-consistent with your render normals

---

## Inpainting for Clean Plates & Removal

### ComfyUI Inpainting Workflow
```
[Load Image] + [Load Image (Mask)] → 
[VAE Encode (Inpaint)] → [KSampler] → [VAE Decode] → [Save Image]
```
- Create mask in Photoshop, Nuke, or AE: white = areas to inpaint, black = preserve
- Crop tightly around the removal area for better results
- Use **Denoising strength 0.6–0.85**: lower = more faithful to original; higher = more creative

### Use Cases in VFX
| Use Case | Viability | Notes |
|----------|-----------|-------|
| Background element removal (non-structural) | High | Works well for small items, cables, minor props |
| Rig removal on simple backgrounds | High | Best on textured, non-repeating surfaces |
| Crowd thinning | Medium | Inconsistent with overlapping people; use with manual cleanup |
| Face/hands on clean plates | Low | AI inpainting on faces is unreliable; manual approach preferred |
| Sign/logo replacement | Medium | Good with ControlNet; may need manual cleanup |

### PowerPaint / BrushNet (Advanced Inpaint)
- More context-aware than standard inpaint; uses entire image for context
- Better for large removal areas
- Still requires manual cleanup for hero shots

---

## AI Roto & Segmentation

### SAM2 (Segment Anything Model v2, Meta)
- Video segmentation: click a subject once, tracks through sequence
- Generates binary mask per frame
- **Output:** PNG mask sequence or video mask
- **Integration:** Can be run standalone, in ComfyUI (ComfyUI-SAM2 nodes), or via Runway

**Workflow for VFX Roto:**
1. Export plate as PNG/EXR sequence
2. Run SAM2: click to select subject on first frame
3. SAM2 propagates selection through clip
4. Export mask sequence → import to Nuke as Roto input
5. **Always manually QC and correct** — AI roto is 70–90% there; hero shots need cleanup

### Runway Act-Two / Runway AI Roto
- Web-based; simpler workflow than local SAM2
- Good for quick roto on simpler subjects
- Upload clip → AI generates matte → download

### DaVinci Resolve Magic Mask
- Built into DaVinci Resolve; no external tool needed
- Click on subject → auto-roto for clip duration
- Quality competitive with SAM2 for many subjects
- Better integration with Resolve-based pipelines

### Depth-Based Holdouts
Use depth maps (from Depth Pro or CG render depth pass) to create approximate holdout
mattes based on depth range — useful for blending CG with BG when traditional roto
would be prohibitively expensive.

---

## AI Upscaling

### Topaz Video AI
- Industry-standard AI upscaling for video
- **Use cases:** 2K plate to 4K delivery, archive footage rescue, proxy upscale
- Key modes:
  - **Proteus** — general purpose; most control
  - **Gaia HQ** — photorealistic; best for clean footage
  - **Iris** — faces; sharpens facial detail
  - **Artemis** — noise reduction + upscale
- Temporal consistency is generally very good for film-grain footage

### Real-ESRGAN (via ComfyUI)
- Open-source alternative to Topaz
- Less temporal consistency than Topaz for video
- Excellent for: single-frame upscale (textures, matte paintings, stills)
- `ComfyUI Ultimate SD Upscale` node: tile-based upscale for very large images

### Magnific AI
- Web-based; high-quality single image upscale with AI hallucination control
- Good for matte painting texture enhancement
- Not suitable for video/frame sequences

### Upscaling in VFX Pipeline
1. VFX plates delivered at native resolution (4K)
2. If upscaling needed: apply **before** any comp work (upscale plates, then comp)
3. Grain: AI upscalers often reduce grain — add matching grain back in comp
4. Confirm upscaled footage matches original grain structure before delivering to DI

---

## AI Motion & Frame Interpolation

### RIFE (Real-Time Intermediate Flow Estimation)
- Frame interpolation: doubles or triples frame rate
- 23.976 → 47.952 fps; 24 → 48 fps; etc.
- **VFX Use:** Overcranked plate conversion; smooth slow-motion from normal speed
- Available in: Topaz Video AI, ComfyUI (ComfyUI-rife-interpolation), standalone

### FILM (Frame Interpolation Large Motion, Google)
- Better handling of large motion than RIFE
- More computationally intensive
- Good for: action sequences with fast camera movement

### Topaz Video AI Slow Motion
- Most production-reliable option
- Handles: motion blur deconvolution before interpolation
- Preserves grain character better than open-source alternatives

### Limitations
- **Repeated textures and fine detail**: interpolation artifacts on highly detailed areas
- **Cut/transition frames**: always set in/out points to avoid interpolating across cuts
- **Transparent elements**: motion blur on semi-transparent elements (smoke, glass) often fails
- Always manually QC every frame after interpolation for hero shots

---

## LoRA Training for Consistent Assets

**LoRA (Low-Rank Adaptation)** — fine-tunes a base model on a small dataset to generate
a specific subject, style, or environment consistently.

### VFX Applications
- **Digital double appearance**: train a LoRA on a character's likeness for concept/previs
- **Consistent environment style**: maintain visual consistency across generated matte painting sections
- **Prop generation**: generate multiple views of a specific vehicle/object

### Training Requirements
- **Dataset**: 15–50 high-quality images of the subject (consistent lighting, varied angles)
- **Captions**: each image captioned with trigger word + description
- **Hardware**: 24GB+ VRAM GPU recommended for SDXL LoRA training
- **Software**: Kohya_ss (most common), Koyha-sd-scripts

### Training Parameters (Starting Point for SDXL LoRA)
```
Network rank (dim): 64
Network alpha: 32
Learning rate: 0.0001 (unet), 0.00005 (text encoder)
Batch size: 2–4
Training steps: 1000–2000 (depends on dataset size)
Resolution: 1024×1024
```

### Using LoRA in ComfyUI
```
[Load LoRA] node: connect between checkpoint model and KSampler
Set strength: 0.6–1.0 (lower = more base model influence)
Use trigger word in prompt
```

---

## Integrating AI Outputs into Nuke/AE Pipeline

### From ComfyUI to Nuke
1. **Output format**: save as EXR or PNG sequence from ComfyUI
2. **Colorspace**: most SD models output in sRGB — confirm and set Read node accordingly
3. **Resolution**: confirm matches comp format (resample if needed)
4. **Alpha channel**: AI outputs are typically RGB-only; create alpha with Keyer or Roto

### Key Integration Workflow
```
[AI Generated Plate (PNG/EXR)] → Read (colorspace: sRGB or linear)
→ OCIOColorSpace (sRGB → ACEScg) if needed
→ Grade (match to plate)
→ Grain (match plate grain profile)
→ Merge (over) onto comp
```

### Matching AI Output to Plate
AI-generated content often needs:
1. **Color grade**: AI outputs tend to be "clean" and contrasty — pull toward plate look
2. **Grain addition**: AI outputs are grain-free; add matching FilmGrain (Nuke) or MNGRN
3. **Lens distortion**: apply matching distortion to AI output if it will be in distorted space
4. **Depth of field**: add matching defocus to match plate's optical characteristics

---

## Frame Consistency Techniques

### The Core Problem
Stable Diffusion generates each frame independently — without video-specific conditioning,
output flickers (different details, slightly different structure per frame).

### Solutions (in order of quality)

**1. AnimateDiff (ComfyUI)**
- Video diffusion model; conditions each frame on neighboring frames
- Much more temporally consistent than single-frame SD
- Typical usable length: 16–48 frames per generation
- Tile and overlap for longer sequences

**2. Deforum / Temporal Coherence Prompting**
- Warps previous frame and uses as conditioning for next frame
- Creates "flowing" effect; can drift significantly over long sequences

**3. IP-Adapter + Temporal Consistency**
- Reference image via IP-Adapter constrains each frame to match a reference
- Better for maintaining subject appearance than environment detail

**4. Post-Generation Temporal Smoothing**
- Generate frames independently → optical flow blend between them (RIFE or DeFlicker)
- Manual cleanup in Nuke for key frames
- **Most reliable for production** — generate then fix

**5. Runway Gen-3 / Kling / Pika (Video Models)**
- Native video generation; inherently temporally consistent
- Quality still not at DI standard (2025) but rapidly improving
- Best current use: **previs, concept animatics, B-roll** — not hero VFX shots

---

## Limitations & QC Considerations

### What AI Cannot Reliably Do (Currently)
- **Photorealistic hero character faces** at DI quality — always needs manual cleanup
- **Accurate object removal** in complex backgrounds with foreground overlap
- **Temporal consistency** over long clips without significant workflow overhead
- **Physical accuracy** — AI doesn't understand physics; fire won't behave like fire
- **Reproduce specific licensed assets** accurately and reliably

### QC Checklist for AI-Generated VFX
- [ ] Frame-by-frame review for temporal artifacts (flickering, popping details)
- [ ] Edge consistency (especially around removed objects)
- [ ] Color match to surrounding plates
- [ ] Grain profile match
- [ ] Geometric consistency (no warping or distortion inconsistency)
- [ ] No AI hallucinations in focus areas (extra fingers, merged text, phantom objects)

### Disclosure & Legal Considerations
- Some studios and broadcasters have **AI usage disclosure requirements**
- Confirm with production legal before using AI tools on talent likenesses (deepfake considerations)
- AI-generated content from some tools may have licensing restrictions — review terms
- Keep records of AI tool usage for compliance and credit purposes
