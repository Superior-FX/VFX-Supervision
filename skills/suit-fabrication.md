# Suit Design & Fabrication Reference

## Table of Contents
1. [Base Layer Selection](#base-layer-selection)
2. [Sensor Placement Map](#sensor-placement-map)
3. [Marker Placement (Optical)](#marker-placement-optical)
4. [Sensor Pocket Construction](#sensor-pocket-construction)
5. [Wiring Harness Design](#wiring-harness-design)
6. [Mounting Methods](#mounting-methods)
7. [Suit Fit & Comfort](#suit-fit--comfort)

---

## Base Layer Selection

The suit is the foundation. It must stay in position during movement — any slipping
causes sensor drift and inaccurate data.

### IMU Suit Requirements
- **Tight fit** — compression is critical; sensors must not shift during movement
- **Stretch fabric** — must move with the body without restricting range of motion
- **Stable mounting points** — fabric must not bag or sag at sensor locations

### Recommended Fabrics
| Fabric | Stretch | Durability | Notes |
|--------|---------|-----------|-------|
| **Compression spandex (4-way)** | High | Medium | Best choice; widely available |
| Neoprene panels at joints | Low | High | Add to high-wear areas (knees, elbows) |
| Lycra athletic wear | High | Medium | Dancewear companies make full-body suits |
| Wetsuit material (3mm) | Low | Very high | For cold environments; limits mobility |

### Where to Source
- **Full-body dancewear/gymnastics suits** — Amazon, Danzcue, discount dance supply
  Look for: zentai suit, unitard, full-body spandex suit
- **Separate top + leggings** — easier to wash; buy 1–2 sizes small for compression
- **Budget option:** $20–$60 for a full suit on Amazon (search "zentai suit" or "full body spandex suit")

### For Optical Suits
- **Black or dark navy only** — maximizes contrast with white/reflective markers
- Matte finish — avoid shiny fabrics that might reflect IR light
- Same tight-fit requirement as IMU

---

## Sensor Placement Map

**Standard 17-point placement** (full body IMU):

```
                    ● HEAD (back of skull, center)
                    │
         ●──────────●──────────●
      SHOULDER L  CHEST/     SHOULDER R
                  STERNUM
         │                    │
         ● UPPER ARM L        ● UPPER ARM R
         │                    │
         ● LOWER ARM L        ● LOWER ARM R
         │                    │
         ● HAND L             ● HAND R

                    ● HIPS (sacrum — most important)
                    │
         ●──────────┘──────────●
      UPPER LEG L           UPPER LEG R
         │                    │
         ● LOWER LEG L        ● LOWER LEG R
         │                    │
         ● FOOT L             ● FOOT R
```

### Sensor Placement Rules
- **Hips/sacrum** — single most important sensor; attach firmly to the lower back
  (sacrum bone); this is the root of the skeleton
- **Limb sensors** — mid-segment, not at the joint; joint sensors get occluded and
  experience the most movement artifact
- **Upper leg** — outer mid-thigh is most stable; avoid inner thigh (skin-on-skin contact)
- **Lower leg** — mid-shin, slightly to the outside
- **Foot** — top of foot (dorsum), slightly toward the ankle
- **Upper arm** — outer mid-humerus; avoid front/back (bicep/tricep) which flex
- **Lower arm** — outer mid-forearm
- **Chest** — sternum; use breastbone as a landmark — stable bone reference
- **Head** — back of skull, center; forehead works but sweats more

### Minimum Viable Sets

**6 sensors (lower body only — walk cycles, basic locomotion):**
Hips + left/right upper leg + left/right lower leg + chest

**11 sensors (full body, no hands):**
Above + head + left/right upper arm + left/right lower arm

**17 sensors (full body with hands):**
Full set as above + both hands + optional shoulders

---

## Marker Placement (Optical)

For optical mocap, markers go on anatomical landmarks — bones and prominences that have
minimal soft tissue movement between the marker and the underlying skeleton.

### Standard 37-Marker Set (VICON/industry standard adapted for DIY)

**Head (4 markers):**
- Front-left forehead
- Front-right forehead
- Back-left skull
- Back-right skull

**Torso (8 markers):**
- Left/right clavicle (collarbone ends)
- Left/right anterior shoulder (front acromion)
- Left/right posterior shoulder (rear acromion)
- Sternum (center chest)
- T10 vertebra (mid-spine, back)

**Arms (8 markers per arm = 16 total):**
- Upper arm outer (mid-humerus)
- Medial/lateral elbow (both sides of elbow joint)
- Upper forearm
- Lower forearm
- Radial/ulnar wrist (both wrist bones)

**Hips/Pelvis (4 markers):**
- Left/right ASIS (anterior superior iliac spine — hip bones front)
- Left/right PSIS (posterior superior iliac spine — hip bones back)

**Legs (8 markers per leg = 16 total):**
- Upper thigh outer
- Lateral/medial knee (both sides)
- Upper shin outer
- Lower shin
- Lateral/medial ankle (both sides)

**Feet (4 markers):**
- Heel
- 1st and 5th metatarsal heads (inside/outside ball of foot)
- Toe tip (optional)

### DIY Marker Construction
**Retroreflective tape markers:**
1. Cut 3M Scotchlite 8910 tape into 14–20mm circles
2. Stick directly to suit at marker positions
3. Use a leather punch or circle punch for consistent sizes

**Spherical markers:**
- Pre-made: 14mm or 25mm retroreflective spheres (search "motion capture markers" on Amazon)
- DIY: polystyrene balls + 3M Scotchlite tape wrapped around them
- Attach with velcro backing

---

## Sensor Pocket Construction

### Method 1: Sewn Pockets (Best Long-Term)

**Materials:**
- Neoprene or scuba fabric (1–2mm) for pockets — stretchy but holds shape
- Thread (elastic or stretch thread)
- Sewing machine or hand sewing

**Construction:**
1. Cut neoprene into rectangles sized to sensor + 5mm clearance on all sides
2. Fold and sew three sides to form a pocket
3. Sew pocket onto suit at marked position, aligning pocket opening toward the body surface
4. Add velcro flap closure to retain sensor

**Pocket Dimensions (BNO085 + TP4056 module):**
- Approximately 35mm × 35mm × 12mm deep (adjust per your sensor size)

### Method 2: Velcro Attachment (Fastest)

**Materials:**
- Sew-on velcro (hook side on suit, loop side on sensor case)
- 3D-printed TPU cases for sensors

**Construction:**
1. Sew velcro patches (hook side) onto suit at each sensor position
2. 3D-print or hand-sew small pouches with loop velcro on the back
3. Press sensor pouches onto suit; pull off for charging/maintenance

**Pros:** Easy to remove and reposition; no permanent modification to suit
**Cons:** Can peel off during intense movement; less secure

### Method 3: Elastic Straps (For External Mounting)

For sensors that need to be repositioned frequently or worn over clothing:
- Use 3–4cm elastic velcro straps (the kind used for cable management or knee braces)
- Insert sensor into a small neoprene pouch
- Strap directly to body segment over clothing

---

## Wiring Harness Design

Wires connecting sensors to hub boards must not restrict movement or create snag points.

### Wire Routing Principles
- Route wires along the **inner seam** of the suit or inside a sewn channel
- Allow **20–30% extra length** at joints so wires don't pull tight during flexion
- Use **silicone-insulated wire** (22 AWG) — remains flexible at body temperature and
  won't stiffen in cold environments
- Secure wires every 10–15cm with small sewn loops or clip anchors

### Hub Placement
Place each ESP32 hub where it won't dig in during movement:
- **Torso hub** — center back, between shoulder blades (flat against spine)
- **Arm hubs** — outer upper arm, above elbow
- **Leg hubs** — outer upper thigh

### Strain Relief at Connectors
- Add a small zip-tie or hot-glue strain relief at each connector point
- JST connectors pull out easily — add a small velcro loop to keep them seated

### Wireless Option (No Wires Between Sensors)
Advanced option: each BNO085 gets its own ESP32 — fully wireless, no inter-sensor wiring.
- More expensive (one ESP32 per sensor instead of per hub)
- Simpler mechanical design
- More WiFi congestion with 17+ devices — requires good router / 5GHz band

---

## Mounting Methods

### For IMU Sensors

| Location | Best Method |
|----------|------------|
| Torso / back | Velcro panel sewn into suit back |
| Upper arm | Elastic strap over suit |
| Forearm | Elastic strap or velcro sleeve |
| Thigh | Sewn pocket in compression legging |
| Shin | Elastic strap; ensure it doesn't rotate |
| Foot | Strap over shoe, or sewn into sock attachment |
| Head | Headband with velcro pocket; or sewn cap |

### Critical: Anti-Rotation
Sensors that rotate relative to the body segment cause errors:
- Thigh and shin sensors are most prone to rotation
- Use two attachment points (two straps) for lower leg sensors
- Consider silicone grip strips sewn into straps to prevent sliding

---

## Suit Fit & Comfort

### Sizing
- Buy 1 size smaller than your normal clothing size
- The suit must have zero sag or bagging at sensor positions
- Movement test: full squat, arms overhead, lateral lunges — no sensor shift

### Sweat Management
- Wear a moisture-wicking base layer under the suit for longer sessions
- Electronics and sweat: apply conformal coating to PCBs/sensors if exposed
- Avoid direct skin contact with solder joints

### Maintenance
- Machine wash inside-out on gentle cycle; air dry (heat damages spandex)
- Check sensor pocket stitching after every 5–10 sessions
- Inspect connector crimps and wire routing monthly
- Replace velcro patches when they lose grip
