# Pre-Production Reference

## Table of Contents
1. [Script Breakdown](#script-breakdown)
2. [VFX Bid Package](#vfx-bid-package)
3. [Shot Complexity Tiering](#shot-complexity-tiering)
4. [Vendor Selection & Bid Leveling](#vendor-selection--bid-leveling)
5. [Tech Scout Checklist](#tech-scout-checklist)
6. [Previs, Techvis & Postvis](#previs-techvis--postvis)
7. [Asset List Generation](#asset-list-generation)
8. [VFX Schedule Integration](#vfx-schedule-integration)
9. [Risk Assessment](#risk-assessment)

---

## Script Breakdown

### Process
1. **Read the script** for intent first — understand story before tagging shots
2. **Tag every VFX moment**: environment extensions, screen replacements, creature work,
   wire removal, de-aging, set extensions, weather, vehicles, crowds, etc.
3. **Distinguish implicit VFX** — not everything is tagged in the script. Look for:
   - Locations that don't exist or can't be safely filmed
   - Time-of-day or weather that requires control
   - Crowd sizes beyond what can be practically achieved
   - Any practical element that will need cleanup

### Breakdown Categories
| Category | Examples |
|----------|---------|
| Environment/Set Extension | CG buildings, horizon extensions, period dressing |
| Character VFX | Creature, de-aging, digital doubles, body augmentation |
| FX Simulations | Fire, water, explosion, smoke, destruction |
| Screen/Prop Replacement | LED screens, digital signage, licensed property removal |
| Vehicle/Transport | Digital vehicles, crowd vehicles, aircraft |
| Wire & Rig Removal | Stunts, flying rigs, camera equipment |
| Sky Replacement | Day-for-night, overcast-to-sunset, storm |
| Invisible VFX | Cleanup, continuity fixes, background replacements |
| Title/Graphic | Opening titles, overlaid text/graphics |

### Breakdown Output
- Marked-up PDF of script with VFX tags
- Shot list spreadsheet: Scene #, Shot description, VFX category, Preliminary tier, Notes
- Initial count: **total number of VFX shots** segmented by category

---

## VFX Bid Package

### What to Include
A well-formed bid package gives vendors everything they need to price accurately. Missing
information leads to exclusions that inflate change orders later.

**Mandatory Elements:**
- Script (or at minimum, all VFX-relevant scenes)
- Shot list with preliminary descriptions
- Director references (mood boards, look references, comparable films)
- Previs / animatic (if available)
- Technical specs (camera, format, resolution, frame rate, delivery specs)
- Schedule milestones (shoot dates, cut lock, VFX finals, delivery)
- Colorspace and pipeline requirements (ACES version, OCIO config, deliverable format)
- Any creative restrictions (talent likeness approvals, IP clearances)

**Optional but Valuable:**
- Location photos / scout images
- Previous similar show's turnover specs as reference
- Approved vendor list (if there are restrictions)

### Bid Request Process
1. Send **RFP (Request for Proposal)** to selected vendors simultaneously
2. Set a **bid response deadline** (typically 2–3 weeks for feature, 1 week for episodic)
3. Make yourself available for **one-on-one calls** with each vendor during bid period
4. Issue **formal addenda** if the scope changes during the bid period — send to all vendors

### What to Specify in the RFP
- Whether vendors are bidding the whole show or a subset
- Whether you want **per-shot itemization** or **package pricing**
- R&D requirements (new tools, custom pipeline work)
- Whether VFX onset supervision is included in the bid scope

---

## Shot Complexity Tiering

A standardized tiering system ensures consistent pricing conversations and budget tracking.

### Tier Definitions

| Tier | Complexity | Typical Days per Shot | Examples |
|------|------------|----------------------|---------|
| **T1 — Simple** | Single-element, contained work | 1–5 | Wire removal, logo replace, basic sky swap |
| **T2 — Standard** | Multi-element comp, some 3D | 5–15 | Screen replacement + environment, CG vehicle |
| **T3 — Complex** | Significant 3D/simulation, complex comp | 15–40 | Destruction sequence, creature in complex lighting |
| **T4 — Hero** | Full CG shot or extensive simulation | 40–120+ | Full digital double, photoreal environment, hero creature |
| **T5 — Sequence** | Sustained hero-level work across many shots | Priced per sequence | Battle sequences, sustained destruction |

### Tiering Tips
- Tier assignments **change** as the project evolves — build in a re-tier process at
  major milestones (shoot completion, picture lock)
- Director changes can push T1 to T3 overnight — track tier changes carefully
- Hidden complexity: simple-looking shots with difficult matchmove (handheld, low texture,
  complex lens) can inflate beyond their initial tier

---

## Vendor Selection & Bid Leveling

### Vendor Evaluation Criteria
- **Reel / Portfolio** — do they have comparable work at the required quality level?
- **Pipeline** — do they support your required colorspace and delivery format?
- **Capacity** — can they absorb the shot count in your schedule?
- **Geography** — time zone, incentive programs (tax credits), language
- **References** — call previous supervisors they've worked with
- **Key personnel** — who specifically will supervise your work?

### Bid Leveling Process
Once bids are received:
1. Normalize all bids to the same shot list (vendors may have excluded/added shots)
2. Build a **bid comparison matrix** (vendor × shot × price × notes)
3. Flag significant outliers — very low bids often have exclusions or capacity issues
4. Hold **clarification calls** before awarding to confirm scope alignment
5. Award based on **value, not price alone** — a low bid from a wrong vendor costs more in fixes

### Multi-Vendor Strategy
- Most features split work across 2–5 vendors by:
  - Shot type (creature vendor, environment vendor, FX vendor)
  - Tier (hero shots to premium vendor, T1/T2 to cost-effective vendor)
  - Geography (schedule coverage across time zones)
- Assign a **lead vendor** for pipeline/colorspace continuity across vendors

---

## Tech Scout Checklist

### Location Scout VFX Notes
For every location, document:

**Photography:**
- [ ] Full 360° stills (equirectangular if possible)
- [ ] Chrome ball + grey ball HDRI reference at human eye height
- [ ] Architectural reference (all walls, floor, ceiling — 4 cardinal directions)
- [ ] Close detail shots (texture reference for CG)
- [ ] Surveying reference shots (for photogrammetry)

**Measurements:**
- [ ] Ceiling height
- [ ] Key structural dimensions (doors, windows, columns)
- [ ] LiDAR scan if available (even iPad-based Matterport is useful)
- [ ] Distance to horizon / skyline

**Lighting Notes:**
- [ ] Time of day and sun angle during location visit
- [ ] Key light sources (practicals, windows, reflective surfaces)
- [ ] Potential light wraps and reflections affecting talent

**VFX-Specific:**
- [ ] Greenscreen or bluescreen staging area feasibility
- [ ] Camera movement restrictions (tracking, crane access)
- [ ] Potential tracking surface quality (texture, feature points)
- [ ] Clean plate feasibility (can the location be cleared?)
- [ ] Aerial/drone access permissions

### Stage Scout VFX Notes
- Stage dimensions and weight-bearing specs
- Lighting grid position and rigging points
- Green/blue screen wall availability and dimensions
- LED volume specs (if applicable): resolution, size, refresh rate, color accuracy specs
- Cyc availability and condition

---

## Previs, Techvis & Postvis

### Definitions
| Term | Stage | Purpose |
|------|-------|---------|
| **Previs** | Pre-production | Explore creative options; low-fidelity camera/editorial |
| **Techvis** | Pre-production | Lock technical parameters for shoot (lens, camera moves, scale) |
| **Postvis** | Post-production | Stand-in CG to allow editorial to cut before VFX finals |
| **Pitchvis** | Development | High-quality animation to sell a concept or sequence |

### Techvis Deliverables
Techvis must answer:
- What lens achieves the desired parallax / scale relationship?
- Where does the camera move, and does it require a motion control rig?
- What is the correct scale for any digital set extension relative to practical set?
- Where must tracking targets be placed?
- What clean plate coverage is required?
- Are any shots impossible with the proposed approach — and what's the alternative?

### Postvis Pipeline
- Delivered to editorial as **proxy resolution**, clearly watermarked
- Postvis artist works from the same plates as comp (early turnover)
- Editorial uses postvis to **lock cut** before VFX finals land
- Postvis must be **replaced** by VFX finals before lock — track replacement status per shot

---

## Asset List Generation

Assets needed before VFX production can begin:

### Asset Categories
| Type | What to Define |
|------|---------------|
| CG Characters / Creatures | Design, reference photos, rig requirements, fur/cloth |
| Digital Doubles | Talent scan session, garment scans, performance reference |
| CG Vehicles | Reference photos all angles, chassis/suspension detail, markings |
| CG Environments | Architectural reference, material reference, scale plans |
| FX Simulations | Scale reference, practical reference footage |
| Matte Paintings | Background plates (if any), size/resolution requirements |
| Props (CG or augmented) | Physical reference or provided CAD data |

### Asset Priority
Assign each asset:
- **Priority** (P1 = on screen in first VFX shot to be delivered)
- **Due date** (works back from first comp delivery for that asset)
- **Owner** (which vendor or internal department)
- **Approval chain** (director, production designer, studio approval)

---

## VFX Schedule Integration

### Key Milestones to Track
| Milestone | Dependency |
|-----------|-----------|
| Principal Photography Start | Determines plate delivery timing |
| Shoot Wrap | Starts final turnover period |
| First Cut (Offline) | Required for VFX turnovers |
| Picture Lock | Hard deadline for new shots; no new work after this |
| VFX Finals Delivery | Drives DI/finishing start |
| DI Start | Requires majority of VFX finals |
| Delivery (Mastering) | Absolute deadline |

### Schedule Buffer Rules
- Build **10–15% contingency** into VFX schedules — shots always creep
- Hero shots should finish **2–3 weeks before deadline** — they will need revisions
- Invisible/cleanup shots are often deprioritized — ensure they're tracked and delivered

---

## Risk Assessment

### Shot-Level Risk Factors
- **Complex matchmove** — handheld, low texture, fast motion, extreme close-up
- **Digital double** — requires approved hero likeness; talent may not approve
- **IP clearance uncertainty** — logos, architecture, vehicles requiring clearance
- **Experimental technique** — first use of new tool or approach on the project
- **Late shoot access** — key reference not captured until late; compresses post schedule
- **Multi-vendor dependency** — shot requires asset from one vendor before another can proceed

### Risk Mitigation
- Flag **top 10 risky shots** at project start; review monthly
- For new techniques: schedule **R&D phase** with defined pass/fail criteria before production commitment
- For digital doubles: schedule **talent scan sessions** in pre-production, not during shoot
- For complex matchmove: mark tracking targets clearly on shoot plan, brief camera operator
