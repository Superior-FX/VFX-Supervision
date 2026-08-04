# IMU Hardware Reference

## Table of Contents
1. [IMU Sensor Comparison](#imu-sensor-comparison)
2. [BNO085 — Recommended Sensor](#bno085--recommended-sensor)
3. [ESP32 as Hub Microcontroller](#esp32-as-hub-microcontroller)
4. [Wiring Diagram (I2C Bus)](#wiring-diagram-i2c-bus)
5. [Power System](#power-system)
6. [PCB Options](#pcb-options)
7. [Sourcing & Where to Buy](#sourcing--where-to-buy)

---

## IMU Sensor Comparison

| Sensor | DoF | Fusion | Drift | Cost | Notes |
|--------|-----|--------|-------|------|-------|
| **BNO085** | 9 (accel+gyro+mag) | On-chip ARVR | Very low | $10–$15 | **Recommended** — best drift correction |
| BNO080 | 9 | On-chip | Very low | $8–$12 | Same die as BNO085, different firmware |
| MPU-9250 | 9 | Software only | Medium | $3–$6 | Requires Madgwick filter on MCU |
| MPU-6050 | 6 (no mag) | Software only | High | $1–$3 | Budget; drifts significantly over time |
| ICM-42688 | 6 | Software only | Low | $5–$10 | Good gyro; no magnetometer |
| LSM6DS3 | 6 | Software only | Medium | $3–$6 | ST Micro; decent quality |

**Why BNO085 over MPU-9250:**
- BNO085 runs its own sensor fusion algorithm on-chip (ARVR Stabilized Game Rotation Vector)
- Dramatically reduces drift compared to software-only fusion
- Handles magnetic disturbance recovery internally
- I2C output is already a quaternion — simpler firmware

---

## BNO085 — Recommended Sensor

### Key Specs
- **Interface:** I2C (default), SPI, UART
- **Supply voltage:** 3.3V (do NOT connect to 5V directly)
- **Current draw:** ~1.4mA active, ~1µA sleep
- **Output:** Quaternion (ARVR Stabilized), Euler angles, raw accel/gyro/mag
- **Update rate:** Up to 1000Hz (100Hz is sufficient for mocap)
- **I2C address:** 0x4A (default) or 0x4B (ALT pin high)

### Breakout Board Options
| Board | Manufacturer | Notes |
|-------|-------------|-------|
| Adafruit BNO085 | Adafruit | Best documented; 3.3V logic; $14.95 |
| SparkFun VR IMU Breakout | SparkFun | QWIIC connector; $17 |
| Bare BNO085 module | AliExpress/LCSC | Cheapest ($3–$6); needs soldering |
| SlimeVR-specific PCB | Community | Designed for SlimeVR; includes charge circuit |

### BNO085 Pinout (I2C Mode)
```
BNO085 Pin    → ESP32 / MCU Pin
──────────────────────────────
VIN / 3V3     → 3.3V
GND           → GND
SDA           → GPIO 21 (default I2C SDA on ESP32)
SCL           → GPIO 22 (default I2C SCL on ESP32)
INT (optional) → Any GPIO (interrupt pin for data-ready)
RST (optional) → Any GPIO (hardware reset)
PS0           → GND (selects I2C mode)
PS1           → GND (selects I2C mode)
```

### Multiple BNO085 on One Bus
- Each BNO085 can be address 0x4A or 0x4B (via ADDR/ALT pin)
- **Maximum 2 BNO085 per I2C bus** at different addresses
- For 3+ sensors per ESP32: use I2C multiplexer (TCA9548A) — adds 8 channels
- Or use separate I2C buses on ESP32 (supports 2 hardware I2C buses)

---

## ESP32 as Hub Microcontroller

The ESP32 acts as the central hub for a cluster of BNO085 sensors, sending data over WiFi to the SlimeVR server or custom receiver.

### Why ESP32
- Built-in WiFi (802.11 b/g/n) — no separate radio module needed
- Dual-core 240MHz — handles sensor polling + WiFi simultaneously
- 3.3V logic — matches BNO085 directly
- Large community; excellent SlimeVR firmware support
- Cheap: $3–$8

### Recommended ESP32 Variants
| Board | Notes |
|-------|-------|
| **ESP32-WROOM-32** (generic) | Most common; works with SlimeVR |
| **Wemos D1 Mini ESP32** | Compact; good for tight suit integration |
| **ESP32-S3** | Better WiFi; needed for >4 sensors per hub |
| **XIAO ESP32C3** | Ultra-compact; good for hand/foot sensors |

### Sensor Clusters Per ESP32
A typical full-body layout uses one ESP32 per limb cluster:

| ESP32 Hub | Sensors |
|-----------|---------|
| Torso hub | Chest + hips + head |
| Left arm hub | Upper arm L + lower arm L + hand L |
| Right arm hub | Upper arm R + lower arm R + hand R |
| Left leg hub | Upper leg L + lower leg L + foot L |
| Right leg hub | Upper leg R + lower leg R + foot R |

**Total: 5 ESP32 hubs × 3 sensors each = 15 sensors minimum**
Add 2 shoulder sensors on torso hub for 17 total.

---

## Wiring Diagram (I2C Bus)

### Single Hub Wiring (3 BNO085 sensors on one ESP32)

```
ESP32 3.3V ──┬──── BNO085 #1 VIN
             ├──── BNO085 #2 VIN
             └──── BNO085 #3 VIN

ESP32 GND ───┬──── BNO085 #1 GND
             ├──── BNO085 #2 GND
             └──── BNO085 #3 GND

ESP32 GPIO21 (SDA) ──┬──── BNO085 #1 SDA
     [4.7kΩ pullup]  ├──── BNO085 #2 SDA
                     └──── BNO085 #3 SDA

ESP32 GPIO22 (SCL) ──┬──── BNO085 #1 SCL
     [4.7kΩ pullup]  ├──── BNO085 #2 SCL
                     └──── BNO085 #3 SCL

BNO085 #1 ADDR → GND (address 0x4A)
BNO085 #2 ADDR → 3.3V (address 0x4B)
BNO085 #3 → Use TCA9548A multiplexer on separate channel
```

**I2C Pullup Resistors:**
- Required: 4.7kΩ on SDA and SCL to 3.3V
- Most breakout boards include these — check before adding
- Adding double pullups drops bus voltage — remove redundant ones

### Power Bus Notes
- Add a **100µF electrolytic capacitor** across 3.3V and GND near each sensor cluster
- Decouples power supply noise from WiFi transmission bursts
- Wire 3.3V and GND as a bus (daisy chain), not a star — keep runs short

---

## Power System

### LiPo Battery Sizing
- **Each sensor hub (ESP32 + 3 BNO085)** draws approximately 150–250mA active
- **500mAh LiPo** → ~2–3 hours capture time per charge
- **800mAh LiPo** → ~3–5 hours
- Minimum battery size: 400mAh per hub

### Recommended Batteries
| Size | Capacity | Dimensions | Notes |
|------|----------|-----------|-------|
| 402030 | 200mAh | 4×20×30mm | Small; for hand/foot |
| 503040 | 500mAh | 5×30×40mm | Standard; good balance |
| 603040 | 800mAh | 6×30×40mm | Larger; longer runtime |

### Charging Circuit
- **TP4056 module** (USB-C or micro-USB) — standard LiPo charger
- 1A charge rate (adjust R_prog if needed for small batteries)
- Include protection circuit (DW01A) — most TP4056 modules include it
- Wire: Battery+ → B+ on TP4056; Battery- → B-; ESP32 VIN → OUT+

### Charging Strategy Options
1. **Remove and charge separately** — simplest; swap batteries between sessions
2. **In-suit charging** — route USB-C cables to accessible points on the suit; charge all hubs simultaneously
3. **Wireless charging** (advanced) — Qi coil per sensor; slower but convenient

---

## PCB Options

### Option 1: Hand-Wired on Perfboard
- No PCB design skills needed
- Slow to build; harder to replicate
- Fine for a first prototype

### Option 2: Community SlimeVR PCBs
- Several community-designed PCBs available on GitHub
- Most common: **DIY SlimeVR Tracker** by gorbit99, Shine Bright, or Moe
- Send gerber files to JLCPCB or PCBWay (~$5–$10 for 10 boards)
- Search: "SlimeVR PCB GitHub" for current popular designs

### Option 3: Custom PCB (KiCad / EasyEDA)
- Design your own for exact form factor
- Combine ESP32 + BNO085 + TP4056 + LiPo connector on one board
- Good for a final clean build; overkill for a first prototype

### Community Resources
- **SlimeVR Discord** `#diy-trackers` channel — most active DIY hardware community
- **GitHub: SlimeVR/SlimeVR-Tracker-ESP** — official firmware + schematic reference
- **Hackaday.io** — several documented DIY mocap suit builds

---

## Sourcing & Where to Buy

### Recommended Suppliers
| Component | Source | Notes |
|-----------|--------|-------|
| BNO085 breakout | Adafruit, SparkFun | Most reliable |
| BNO085 bare module | LCSC, AliExpress | Cheapest; needs careful soldering |
| ESP32 | Amazon, AliExpress, Mouser | Generic WROOM-32 works |
| LiPo batteries | Adafruit, Amazon, HobbyKing | Check mAh and connector type |
| TP4056 modules | Amazon, AliExpress | Buy in bulk (10-pack) |
| Connectors (JST) | Amazon, DigiKey | JST PH 2-pin most common |
| Silicone wire | Amazon (22 AWG silicone) | Stays flexible at body temp |
| Spandex suit | Amazon, dancewear shops | Tight fit critical |

### AliExpress Tips
- BNO085 modules from AliExpress: verify it's BNO085 not BNO080 (similar but different)
- Factor in 3–6 week shipping times for overseas orders
- Order 10–20% more than needed — some will be DOA
