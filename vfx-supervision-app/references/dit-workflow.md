# DIT Services & Workflow Reference

## Table of Contents
1. [DIT Role & Responsibilities](#dit-role--responsibilities)
2. [On-Set Data Offload & Redundancy](#on-set-data-offload--redundancy)
3. [Software: Silverstack, Livegrade, Hedge](#software-silverstack-livegrade-hedge)
4. [Dailies Workflow](#dailies-workflow)
5. [LUT Application & Color-Managed Preview](#lut-application--color-managed-preview)
6. [Metadata Management](#metadata-management)
7. [Archiving Strategy](#archiving-strategy)
8. [QC Checklist](#qc-checklist)
9. [Remote & Cloud Dailies](#remote--cloud-dailies)

---

## DIT Role & Responsibilities

**DIT (Digital Imaging Technician)** bridges camera department and post production. On a
VFX show the DIT works closely with the VFX Supervisor to ensure:
- Camera data is captured, verified, and backed up correctly
- On-set color is managed and documented for post
- Dailies are transcoded in the correct colorspace and with correct metadata
- Any issues with capture (dropped frames, exposure issues) are flagged immediately

### DIT vs. Data Manager (Loader)
- **Data Manager / Loader**: responsible for physical media offload and backup only
- **DIT**: manages the above PLUS color science, on-set monitoring pipeline, and dailies
- On smaller productions, one person may do both roles; larger productions separate them

---

## On-Set Data Offload & Redundancy

### The 3-2-1 Rule (Minimum Standard)
- **3** copies of all data
- **2** different media types (e.g., SSD + HDD, or SSD + LTO)
- **1** offsite / off-truck location

In practice on a film set:
- Copy 1: Camera original media (held until checksum verified)
- Copy 2: Primary offload SSD/RAID (stays with production)
- Copy 3: Duplicate offload SSD/RAID (shipped to post facility daily)

### Checksum Verification
- Generate **MD5 or xxHash checksums** for every file during offload
- Verify checksums on both copies before releasing camera media for reuse
- **Never reuse media without verified checksum match**
- Tools: Silverstack, Hedge, YoYotta, BRU-PE

### Offload Speed & Media Management
- Identify offload bottlenecks early: ARRIRAW 4.5K generates ~2TB/hour
- Have enough media to cover shoot day without waiting for offload completion
- **Label all media** clearly: Camera, Roll, Date, Day #, Project

### Storage Hardware
| Type | Use Case | Notes |
|------|----------|-------|
| NVMe SSD (portable) | Primary offload, fast access | Fragile under field conditions |
| Rugged SSD (G-DRIVE, LaCie Rugged) | On-set primary copy | Better durability |
| RAID (Promise, G-RAID) | Secondary copy, capacity | Higher storage-to-cost ratio |
| LTO Tape (LTO-8 or LTO-9) | Archive | Most cost-effective long-term; requires tape library |

---

## Software: Silverstack, Livegrade, Hedge

### Silverstack (Pomfort)
All-in-one data management + basic color management.
- Offload, verify, and organize camera originals
- Create transcodes (dailies) directly or pass to dedicated transcode system
- Apply CDLs and LUTs per clip for color-managed dailies
- Generates **detailed reports** (camera reports, loader reports)
- Supports all major camera formats: ARRIRAW, R3D, BRAW, Sony RAW, etc.

### Livegrade (Pomfort)
Real-time on-set color grading and CDL management.
- Connect to DIT cart via SDI for live color preview on calibrated monitor
- Apply and adjust CDLs per shot in real time
- Sync CDLs to Silverstack automatically (via Pomfort Livegrade ↔ Silverstack integration)
- Export CDLs as .ccc for use in dailies pipeline and DI
- Supports OCIO for color-managed viewing on set

### Hedge
Dedicated high-speed offload and checksum verification tool.
- Fast, reliable offload with verification
- Not a color management tool — pairs with Silverstack or Livegrade for a complete pipeline
- Popular as a standalone offload solution when full Silverstack setup isn't needed

### Other Tools
- **YoYotta** — popular for larger productions; strong LTO integration
- **BRU-PE** — backup and restore with verification; often used for LTO workflows
- **DaVinci Resolve** — some DITs use Resolve for both grading and dailies

---

## Dailies Workflow

### Dailies Purpose
Dailies are low-latency viewing copies distributed to the director, editor, producer, and
key department heads within 24 hours of shooting. They may have:
- A viewing LUT baked in (show look)
- Burn-in overlays (scene/shot/take, timecode, camera info)
- Reduced resolution for efficient distribution

### Dailies Pipeline

```
Camera RAW → Silverstack (offload + verify)
→ Transcode with CDL + LUT baked → ProRes / DNxHR
→ Burn-in (scene/take/TC/camera) 
→ Upload to review platform (Frame.io / Moxion / Screenlight)
→ Distribute to director, editor, producer
```

### Recommended Dailies Specs
| Parameter | Recommendation |
|-----------|---------------|
| Codec | ProRes 4444 (with alpha for elements); ProRes 422 HQ (cost-effective) |
| Resolution | Same as camera native, or downscale to 2K for efficiency |
| Frame rate | Match camera (do not change) |
| Colorspace | Rec.709 or P3-D65 for viewing, with show LUT baked |
| Burn-ins | Scene, shot, take, clip name, timecode, camera, day/date, show name |
| Audio | Sync'd double-system audio where applicable |

### VFX Dailies (Different from Editorial Dailies)
VFX dailies must be delivered without any LUT baked in — in original log colorspace:
- Format: ProRes 4444 XQ or full RAW
- Colorspace: **Camera-native log, no grade**
- Include metadata: scene/shot/take, camera, lens, T-stop
- These are the VFX vendor's working plates — do not apply any transforms

---

## LUT Application & Color-Managed Preview

### On-Set Monitoring Chain
```
Camera SDI out → LUT box (Teradek COLR, Flanders Boxio, Nobe Omniscope)
→ CDL + show LUT applied → Calibrated monitor (Rec.709 or P3)
```

### LUT Box Options
| Device | Notes |
|--------|-------|
| Teradek COLR | OCIO-capable; integrates with Livegrade |
| Flanders Scientific BoxIO | High-quality, supports OCIO v2 |
| Nobe Omniscope | Software-based; runs on macOS; flexible |
| Blackmagic Teranex | Standalone hardware LUT applier |

### Show Look on Set
- The **show LUT** (or show-look CDL + LUT) should be the same transform used in dailies
- Ensures director is approving the look they'll see in editorial
- All monitoring on set should use **calibrated displays** — ideally P3-D65 calibrated

### OCIO on Set
- Increasingly common to run a full **OCIO-based monitoring pipeline** on set
- Requires: OCIO config, compatible LUT box or software, trained DIT
- Provides consistent color from set → dailies → VFX → DI

---

## Metadata Management

### Critical Metadata to Capture
- Camera model, serial number
- Lens make, model, focal length, T-stop
- Frame rate, shutter angle
- ISO / EI setting
- White balance
- Scene, shot, take (from slate)
- Reel / magazine number
- Camera operator, DIT, loader names
- Location / stage

### Metadata Workflow
1. Camera metadata embedded in RAW files automatically
2. Slate metadata captured manually by loader / DIT
3. Merge in Silverstack using clip sync (timecode matching or manual)
4. Export complete **camera report** per day
5. Store with camera originals and deliver to post facility

### ALE (Avid Log Exchange)
- Standard format for transferring metadata from production to Avid editorial
- Generated by Silverstack, Final Cut Pro, etc.
- Contains: clip name, timecode, scene/shot/take, reel, camera info

### VFX-Specific Metadata
For every VFX shot, record additionally:
- VFX shot number (as defined in VFX breakdown)
- Tracking marker status (placed / not placed)
- Clean plate captured (Y/N)
- HDRI captured (Y/N)
- VFX notes (e.g., "wire visible on left at frame 142")

---

## Archiving Strategy

### Archive Tiers
| Tier | What | Media | Retention |
|------|------|-------|-----------|
| Production Archive | Camera originals + all dailies | LTO-8/9 + cloud | Life of rights |
| Project Archive | Finals, project files, key assets | LTO + cloud | Life of rights |
| Working Archive | Current project active files | RAID / SAN | Duration of production |

### LTO Tape Workflow
- **LTO-8**: 12TB native / 30TB compressed per tape
- **LTO-9**: 18TB native / 45TB compressed per tape
- Always write **two copies** per tape (on separate tape sets)
- Verify tapes after write — do not skip verification
- Store tapes in climate-controlled, offsite facility
- Index all tapes in a database (YoYotta, Xendata, or custom)

### Cloud Archive
- **AWS S3 Glacier / Deep Archive** — lowest cost long-term; retrieval latency
- **Backblaze B2** — more cost-effective than AWS for active access
- Cloud archive is NOT a substitute for physical LTO — use as third copy
- Encrypt sensitive content before cloud upload; manage keys separately

### What to Archive (VFX Specific)
- Camera originals (RAW)
- All VFX plates (RAW or EXR)
- VFX finals (EXR + deliverable codec)
- All Nuke / AE project files
- OCIO config used on the project
- All LUTs and CDLs
- HDRI and reference photography
- Survey and measurement data

---

## QC Checklist

### Daily Offload QC
- [ ] Checksums verified on both copies
- [ ] No file size discrepancies from camera report
- [ ] All reels/mags accounted for
- [ ] Camera reports generated and filed
- [ ] Metadata complete (scene/shot/take present)

### Dailies QC
- [ ] Correct LUT/look applied
- [ ] Correct frame rate
- [ ] Burn-ins accurate (scene/shot/take matches camera report)
- [ ] Audio sync correct
- [ ] No dropped frames or file corruption
- [ ] All VFX shots included; log any missing

### VFX Plates QC
- [ ] Log colorspace confirmed (no transform baked in)
- [ ] Resolution matches spec
- [ ] Frame handles included (correct frame count)
- [ ] Correct frame rate
- [ ] Metadata file included
- [ ] File naming matches turnover spec

---

## Remote & Cloud Dailies

### Remote Dailies Pipeline
```
On-set offload (Silverstack) → Transcode → Upload (Aspera / Frame.io)
→ Cloud review platform → Remote viewing (encrypted link)
```

### Platforms
| Platform | Best For |
|----------|---------|
| Frame.io | Collaborative review; integrates with Premiere, Final Cut |
| Moxion | Secure dailies; strong studio adoption |
| Screenlight | Independent productions; cost-effective |
| Sohonet ClearView | High-quality remote viewing; theatrical-grade |
| Cinesync | Frame-accurate sync for remote review sessions |

### Security Considerations
- Confirm platform is approved by studio security requirements
- Use **watermarked dailies** for any external distribution
- Forensic watermarking (Verimatrix, Irdeto) for high-profile projects
- Never share unwatermarked camera originals via consumer platforms
