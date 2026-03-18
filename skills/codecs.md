# Codecs & File Formats Reference

## Table of Contents
1. [Format Categories Overview](#format-categories-overview)
2. [Camera RAW Formats](#camera-raw-formats)
3. [Intermediate Codecs](#intermediate-codecs)
4. [VFX & Finishing Formats](#vfx--finishing-formats)
5. [Delivery Codecs](#delivery-codecs)
6. [Container Formats](#container-formats)
7. [Frame Rate Reference](#frame-rate-reference)
8. [Bit Depth Reference](#bit-depth-reference)
9. [Compression Tradeoffs](#compression-tradeoffs)
10. [Format Selection Guide](#format-selection-guide)

---

## Format Categories Overview

| Category | Examples | Use Case |
|----------|---------|---------|
| Camera RAW | ARRIRAW, R3D, BRAW, Sony RAW | Original capture; maximum quality; archival |
| Intermediate | ProRes, DNxHD/DNxHR, CinemaDNG | Editorial, dailies, interchange |
| VFX/Finishing | EXR, DPX, TIFF | Compositing, DI, archival masters |
| Delivery | H.264, H.265, AV1, JPEG2000 | Streaming, theatrical, broadcast |
| Mezzanine | ProRes 4444, MXF OP1a | Broadcast interchange, HDR masters |

---

## Camera RAW Formats

### ARRIRAW
- **Cameras:** ALEXA 35, ALEXA Mini LF, ALEXA LF, ALEXA XT/SXT/Mini
- **Container:** .ari (single-frame) or .mxf
- **Bit depth:** 12-bit (ALEXA 35 native), 12-bit log-encoded
- **Colorspace:** LogC3 (all pre-ALEXA 35) or LogC4 (ALEXA 35 only)
- **Data rates:** ~150–250 MB/s (4K ARRIRAW), up to ~500 MB/s (ALEXA 35 4.6K)
- **Notes:** True sensor RAW; no in-camera processing; requires ARRI SDK or compatible RAW processor

### RED (R3D)
- **Cameras:** V-RAPTOR, MONSTRO, HELIUM, GEMINI, KOMODO, RAPTOR
- **Container:** .r3d (proprietary)
- **Bit depth:** 16-bit RAW (stored as 12-bit compressed)
- **Colorspace:** REDWideGamutRGB / IPP2 (recommended), or Legacy
- **Compression ratios:** 3:1 (lossless), 5:1, 8:1, 12:1, 18:1 — lower = higher quality
- **Notes:** Always use IPP2 pipeline; Legacy color science is deprecated

### BRAW (Blackmagic RAW)
- **Cameras:** URSA Cine 17K, URSA Mini Pro 12K, Pocket Cinema 6K/4K
- **Container:** .braw
- **Bit depth:** 12-bit RAW
- **Colorspace:** Blackmagic Film Gen 5 / Blackmagic Wide Gamut Gen 5
- **Compression:** Lossless, 3:1, 5:1, 8:1, 12:1 (Q = quality constant modes available)
- **Notes:** Decodes natively in DaVinci Resolve; requires BRAW plugin for other apps

### Sony RAW (X-OCN)
- **Cameras:** VENICE, VENICE 2, BURANO
- **Container:** .mxf (MXF-wrapped X-OCN)
- **Bit depth:** 16-bit
- **Colorspace:** S-Log3 / S-Gamut3 or S-Gamut3.Cine
- **Compression:** X-OCN XT (highest quality), ST (standard), LT (lightweight)
- **Notes:** Requires Sony RAW Viewer or compatible SDK for decoding

### Canon RAW (Cinema RAW Light)
- **Cameras:** C70, C300 III, C500 II, C700
- **Container:** .crm
- **Bit depth:** 10-bit or 12-bit
- **Colorspace:** Canon Log 2 or Canon Log 3
- **Notes:** Requires Canon Cinema RAW Development or compatible plugin

### DJI RAW
- **Cameras:** Inspire 3 (Zenmuse X9), Ronin 4D, Mavic 3 Cine
- **Container:** .dng (Cinema DNG) or .insraw
- **Colorspace:** D-Log M / DJI Cinema Color System (DCCS)
- **Notes:** D-Log M is the current standard for DJI aerial; use DJI's OCIO config

---

## Intermediate Codecs

### Apple ProRes Family

| Variant | Data Rate (4K 24p) | Bit Depth | Quality Use Case |
|---------|-------------------|-----------|-----------------|
| ProRes 422 LT | ~330 Mbps | 10-bit | Proxy / lightweight editorial |
| ProRes 422 | ~470 Mbps | 10-bit | Standard editorial |
| ProRes 422 HQ | ~710 Mbps | 10-bit | High-quality editorial, dailies |
| ProRes 4444 | ~330 Mbps | 12-bit | VFX, CGI, with alpha channel |
| ProRes 4444 XQ | ~500 Mbps | 12-bit | Highest quality; wide-gamut/HDR |
| ProRes RAW | Variable | 12-bit | Camera RAW via Apple pipeline |
| ProRes RAW HQ | Variable | 12-bit | Higher quality RAW via Apple |

**Notes:**
- ProRes 4444/4444XQ supports **alpha channel** — use for VFX elements
- ProRes is Apple-patented but widely readable on macOS; Windows requires codec packs
- **Rec. for VFX:** ProRes 4444 XQ or ProRes 4444

### Avid DNxHD / DNxHR

| Variant | Data Rate | Bit Depth | Use Case |
|---------|-----------|-----------|---------|
| DNxHD 115 | 115 Mbps (1080p) | 8-bit | Offline editorial |
| DNxHD 175x | 175 Mbps (1080p) | 10-bit | High-quality 1080p |
| DNxHR LB | 45 Mbps (4K) | 8-bit | Low-bandwidth 4K proxy |
| DNxHR SQ | 145 Mbps (4K) | 8-bit | Standard 4K editorial |
| DNxHR HQX | 440 Mbps (4K) | 12-bit | High-quality 4K; VFX/HDR |
| DNxHR 444 | 440 Mbps (4K) | 12-bit | Highest quality; 4:4:4 chroma |

**Notes:**
- DNxHR HQX or 444 for any VFX-related work
- DNxHD/HR is cross-platform; better Windows support than ProRes
- MXF or MOV container

---

## VFX & Finishing Formats

### OpenEXR (EXR)
The standard format for VFX work. Developed by ILM; open standard maintained by ASWF.

**Key Parameters:**
| Parameter | Options | Recommendation |
|-----------|---------|---------------|
| Bit depth | 16-bit half-float, 32-bit float | **16-bit half** for most work; 32-bit for extreme HDR values |
| Compression | None, RLE, ZIP, ZIPS, PIZ, PXR24, B44, DWAA, DWAB | **ZIP** (lossless) for VFX plates; **DWAA/B** for archival at smaller size |
| Channels | Single, multi-layer | Multi-layer for AOV delivery |
| Tiling | Scanline, tiled | Tiled for faster random access in large files |

**Compression Detail:**
- **None** — maximum speed, largest file
- **ZIP / ZIPS** — lossless; ZIP = full scanline groups; ZIPS = single scanline
- **PIZ** — lossless; often best compression for noisy/film-grain images
- **DWAA / DWAB** — lossy; excellent quality-to-size ratio; use for distribution, not masters
- **PXR24** — lossy but high quality; reduces 32-bit to 24-bit

**Multi-Layer EXR:**
Single file containing multiple named channels (beauty, diffuse, specular, depth, etc.).
Access in Nuke via Shuffle node. Dramatically simplifies pipeline vs. per-pass file sequences.

### DPX (Digital Picture Exchange)
- Legacy format; still used in some DI workflows and scan/print pipelines
- 10-bit or 16-bit; log or linear encoding
- Single channel per file (no multi-layer); large file sizes vs. EXR
- **Modern recommendation:** Use EXR over DPX for new pipelines unless DI specifically requires DPX

### TIFF
- 8-bit, 16-bit, or 32-bit float
- Widely supported; no multi-layer (without special extensions)
- Used in matte painting and asset workflows; not typically for plate sequences
- ZIP or LZW compression options

---

## Delivery Codecs

### H.264 (AVC)
- Ubiquitous; supported everywhere
- Max quality: 8-bit 4:2:0 (YUV); limited color fidelity
- Use for: **proxy review copies, reference cuts, low-priority distribution**
- CRF 18–23 typical for good quality
- **Not acceptable for VFX plates or master delivery**

### H.265 (HEVC)
- ~50% better compression vs H.264 at same quality
- Supports 10-bit and 4:2:2 in some profiles
- Use for: **streaming delivery, 4K HDR consumer content, efficient proxy**
- Wide hardware decode support; slower software encode than H.264
- Profile: Main10 for 10-bit HDR delivery

### AV1
- Open standard; excellent compression; 10-bit support
- Growing adoption: Netflix, YouTube, Android
- Slower encode than HEVC; faster improving with hardware encoders
- Use for: **streaming platform delivery** where supported

### JPEG 2000 (J2K)
- Use for: **DCI theatrical delivery** (in MXF container for DCPs)
- Lossy or lossless
- Required for DCI-compliant DCPs (Digital Cinema Packages)
- Not for VFX or intermediate use

### Uncompressed / V210
- Uncompressed 10-bit 4:2:2 YUV
- Used in broadcast playout and some final master situations
- Very large files; limited to specific broadcast pipeline requirements

---

## Container Formats

| Container | Common Codecs | Use Case |
|-----------|--------------|---------|
| .mov (QuickTime) | ProRes, H.264, HEVC, DNxHR | macOS-native; editorial, VFX interchange |
| .mxf (MXF) | DNxHD/HR, XDCAM, J2K, ProRes | Broadcast, DCI, camera originals |
| .mp4 | H.264, H.265, AV1 | Web delivery, mobile, streaming |
| .mkv (Matroska) | H.264, H.265, AV1 | Archive, streaming; flexible multi-track |
| .ari | ARRIRAW | ARRI-specific RAW capture |
| .r3d | RED RAW | RED-specific RAW capture |
| .braw | Blackmagic RAW | Blackmagic-specific RAW |

---

## Frame Rate Reference

| Frame Rate | Usage |
|-----------|-------|
| 23.976 fps | US/NA film distribution; most streaming content |
| 24 fps | True cinema; international film; some streaming |
| 25 fps | PAL broadcast; European film/TV |
| 29.97 fps | NTSC broadcast; US TV |
| 30 fps | Some streaming; newer formats |
| 48 fps | HFR (High Frame Rate) cinema — rare |
| 60 fps | Sports, HFR, some streaming; VFX implication: more frames to comp |
| 120 fps | Specialty high-speed; usually slowed down in post |

**VFX Notes:**
- Always confirm frame rate in the VFX spec sheet — mismatches cause subtle motion artifacts
- When camera shoots overcrank (high speed), confirm **pulldown/pullup** workflow with editorial
- Motion blur in CG must match camera shutter angle: 180° shutter = half-frame exposure
- For 23.976 + 29.97 mixed deliveries: build into the spec from day one — don't assume

---

## Bit Depth Reference

| Bit Depth | Values per Channel | Use Case |
|-----------|------------------|---------|
| 8-bit | 256 | Display, web, proxy — limited for VFX |
| 10-bit | 1,024 | Broadcast delivery, ProRes 422, decent for editorial |
| 12-bit | 4,096 | Camera RAW, ProRes 4444, high-quality intermediate |
| 16-bit (int) | 65,536 | Deep color; some scan formats |
| 16-bit half-float | 65,504 (IEEE 754 half) | EXR standard; sufficient for most VFX |
| 32-bit float | ~4 billion | CG renders, deep compositing; rarely needed in delivery |

**Half-float range:** Can represent values from ~5.96×10⁻⁸ to 65504.
For VFX, this means: if your CG has linear values above ~65000 (e.g., very bright light
sources), consider 32-bit float to avoid clipping.

---

## Compression Tradeoffs

| Scenario | Recommended Codec | Reasoning |
|----------|------------------|-----------|
| VFX hero plates to vendor | EXR 16-bit, ZIP lossless | No quality loss; standard across facilities |
| Camera originals archive | RAW format (ARRIRAW, R3D, BRAW) | Maximum fidelity; no generational loss |
| VFX finals from vendor | EXR 16-bit multi-layer, ZIP | Standard DI ingest format |
| Dailies with baked LUT | ProRes 422 HQ or 4444 | Fast decode for editorial; good quality |
| Reference / review H.264 | H.264 at CRF 18 | Smallest size; acceptable quality for review |
| Streaming 4K HDR delivery | H.265 Main10 or AV1 | Efficient; HDR-capable |
| Broadcast HD delivery | ProRes 4444 or MXF/DNxHR | Broadcast QC-compliant |
| Theatrical DCP | JPEG 2000 in MXF | DCI standard requirement |

---

## Format Selection Guide

### Quick Decision Tree

**Is this for compositing / VFX work?**
→ Yes → **EXR 16-bit half-float, ZIP, scene-linear or camera log**

**Is this for editorial offline?**
→ Yes → **ProRes 422 HQ (Mac) or DNxHR SQ (cross-platform)**

**Is this a camera original for archival?**
→ Yes → **Keep as RAW (ARRIRAW, R3D, BRAW, etc.) — never transcode archives**

**Is this a dailies viewable with look baked in?**
→ Yes → **ProRes 4444 (with LUT baked) or ProRes 422 HQ**

**Is this for final delivery to DI/finishing?**
→ Yes → **EXR multi-layer, 16-bit, ZIP, scene-linear**

**Is this for streaming platform delivery?**
→ Yes → **H.265 Main10 (4K HDR) or H.264 (1080p SDR)** — confirm platform spec

**Is this for theatrical (DCP)?**
→ Yes → **JPEG 2000 / MXF — consult DCI spec or your DCP mastering house**
