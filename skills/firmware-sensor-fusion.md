# Firmware & Sensor Fusion Reference

## Table of Contents
1. [SlimeVR Firmware (Recommended)](#slimevr-firmware-recommended)
2. [Sensor Fusion Algorithms](#sensor-fusion-algorithms)
3. [Calibration Procedures](#calibration-procedures)
4. [WiFi Configuration](#wifi-configuration)
5. [Custom Firmware (Advanced)](#custom-firmware-advanced)

---

## SlimeVR Firmware (Recommended)

SlimeVR is the leading open-source IMU mocap/tracking system. Originally built for VR
full-body tracking, it outputs skeleton data usable for animation.

### Repository
`github.com/SlimeVR/SlimeVR-Tracker-ESP`

### Supported Hardware
- ESP8266 / ESP32 / ESP32-S3
- BNO085, BNO080, MPU-9250, MPU-6050, ICM-20948, BMI160, and more
- Define your sensor in `defines.h`

### Flashing Firmware

**Prerequisites:**
- VSCode + PlatformIO extension
- Python 3.x
- USB cable to ESP32

**Steps:**
1. Clone repo: `git clone https://github.com/SlimeVR/SlimeVR-Tracker-ESP`
2. Open in VSCode with PlatformIO
3. Edit `src/defines.h`:
   ```cpp
   // Set your IMU type
   #define IMU IMU_BNO085
   // Set your I2C pins
   #define PIN_IMU_SDA 21
   #define PIN_IMU_SCL 22
   // Set rotation offset for your mounting orientation
   #define IMU_ROTATION DEG_90
   ```
4. Edit `credentials.h` — add your WiFi SSID and password
5. Build + upload (PlatformIO: click the → arrow)
6. Monitor serial output to confirm IMU detected

### IMU Rotation Constants
If the sensor is mounted sideways or inverted, set the rotation offset:
```cpp
#define IMU_ROTATION DEG_0    // Sensor chip up, label facing up
#define IMU_ROTATION DEG_90   // Rotated 90° clockwise
#define IMU_ROTATION DEG_180  // Upside down
#define IMU_ROTATION DEG_270  // Rotated 90° counter-clockwise
```
Determine by running SlimeVR server after mount, checking if axes match expected movement.

### Multiple Sensors Per ESP32
For 2 sensors on one ESP32 with TCA9548A multiplexer:
```cpp
#define SECOND_IMU true
#define PIN_IMU_SCL_2 22    // same bus usually
#define PIN_IMU_SDA_2 21
#define IMU_ADDR_2 0x4B     // second address
```

---

## Sensor Fusion Algorithms

Sensor fusion combines accelerometer, gyroscope, and magnetometer data into a stable
orientation estimate (quaternion).

### Why Fusion Is Needed
- **Accelerometer alone**: measures gravity direction (gives tilt) but is noisy and
  affected by motion acceleration
- **Gyroscope alone**: measures rotation rate accurately but drifts over time (integrating
  small errors accumulates)
- **Magnetometer alone**: gives absolute heading but is affected by local magnetic fields
- **Fusion**: combines all three to get stable, drift-corrected orientation

### Madgwick Filter
Most common DIY fusion algorithm. Open source, computationally lightweight.

**How it works:**
- Integrates gyroscope data (fast, accurate short-term)
- Uses gradient descent to correct toward the gravity/magnetic field reference (drift correction)
- Beta parameter controls speed of correction vs. noise

**Key parameter: beta**
- `beta = 0.01` — slow correction; less noise but more drift
- `beta = 0.1` — moderate; good default
- `beta = 0.5` — fast correction; jittery but drift-free

```cpp
// Arduino / ESP32 Madgwick implementation
#include <MadgwickAHRS.h>
Madgwick filter;
filter.begin(100); // 100Hz update rate

// In loop:
filter.updateIMU(gx, gy, gz, ax, ay, az); // 6DOF (no mag)
filter.update(gx, gy, gz, ax, ay, az, mx, my, mz); // 9DOF (with mag)

float roll = filter.getRoll();
float pitch = filter.getPitch();
float yaw = filter.getYaw();
```

### Mahony Filter
Similar to Madgwick but uses a proportional-integral controller instead of gradient descent.
- Slightly faster computationally
- Two parameters: `Kp` (proportional) and `Ki` (integral)
- Generally similar quality to Madgwick for mocap use

### BNO085 On-Chip Fusion (Best)
The BNO085 runs its own proprietary fusion algorithm (SH-2 protocol):
- **Game Rotation Vector** — 6DOF; no magnetometer (avoids magnetic interference)
- **ARVR Stabilized Game Rotation Vector** — same but optimized for low-drift VR use
- **Rotation Vector** — 9DOF; uses magnetometer for absolute yaw reference

For mocap: use **ARVR Stabilized Game Rotation Vector** — best drift performance
without magnetic interference issues.

```cpp
// BNO085 via Adafruit library
#include <Adafruit_BNO08x.h>
Adafruit_BNO08x bno;
sh2_SensorValue_t sensorValue;

// Enable ARVR stabilized game rotation vector at 100Hz
bno.enableReport(SH2_ARVR_STABILIZED_GRV, 10000); // 10000µs = 100Hz

// Read
if (bno.getSensorEvent(&sensorValue)) {
  float qx = sensorValue.un.arvrStabilizedGameRotationVector.i;
  float qy = sensorValue.un.arvrStabilizedGameRotationVector.j;
  float qz = sensorValue.un.arvrStabilizedGameRotationVector.k;
  float qw = sensorValue.un.arvrStabilizedGameRotationVector.real;
}
```

---

## Calibration Procedures

### BNO085 Calibration (Automatic with Manual Trigger)
The BNO085 self-calibrates over time but benefits from a deliberate calibration routine.

**Accelerometer calibration:**
1. Place the sensor flat on each of its 6 faces for 2–3 seconds each
2. The sensor detects gravity direction on each axis

**Gyroscope calibration:**
1. Leave the sensor completely still for 3–5 seconds at startup
2. The sensor measures gyro bias (offset when stationary)

**Magnetometer calibration:**
1. Rotate the sensor in a figure-8 pattern covering all orientations
2. This maps the local magnetic field

**In SlimeVR:** The server will prompt you to perform a "yaw reset" (stand in T-pose)
and an "ankle calibration" (stand upright, feet flat) — do these before every session.

### IMU Mounting Calibration
Each sensor's physical mounting orientation relative to the body segment must be defined.

**SlimeVR method:**
1. Wear the suit, stand in a T-pose (arms out, feet hip-width apart)
2. In SlimeVR Server: click "Reset" → "Full Reset"
3. The server computes mounting offsets from this reference pose
4. Repeat if sensors shift during donning/doffing

### Per-Session Calibration Checklist
1. Start SlimeVR Server
2. Put on suit — all sensors connected and powered
3. Stand still for 5 seconds (gyro bias stabilization)
4. Perform full reset in T-pose
5. Perform ankle calibration (stand straight, feet flat)
6. Walk 5–10 steps, check foot skating — adjust if needed

---

## WiFi Configuration

### Network Requirements
- **2.4GHz WiFi** — ESP32 only supports 2.4GHz (not 5GHz)
- **Low congestion** — 17 ESP32 devices on the same channel can cause packet loss
- **Dedicated router or access point** recommended for capture sessions
- **Static IP assignment** (DHCP reservation) — prevents reconnection delays

### Reducing WiFi Congestion
- Use a dedicated router for the mocap suit (don't share with streaming/browsing)
- Set router to use a fixed WiFi channel (channel 1, 6, or 11 — least overlap)
- ESP32-S3 supports 2.4GHz with better antenna performance than older ESP32
- If using many sensors: a WiFi 6 router handles more simultaneous devices better

### UDP vs TCP
SlimeVR uses UDP for sensor data — lower latency than TCP, acceptable packet loss.
For live streaming to animation software, latency of 10–30ms is typical.

### Checking Connection
Monitor serial output after flashing — the ESP32 will print:
```
Connecting to WiFi...
Connected! IP: 192.168.1.105
Connecting to SlimeVR server at 192.168.1.100:6969
Connected to server!
Sensor 0: BNO085 initialized
```
If "Sensor 0: Not found" — check I2C wiring and address.

---

## Custom Firmware (Advanced)

If not using SlimeVR, you can write firmware that outputs data in any format.

### Minimal ESP32 Firmware Structure
```cpp
#include <WiFi.h>
#include <WiFiUdp.h>
#include <Wire.h>
#include <Adafruit_BNO08x.h>

WiFiUDP udp;
Adafruit_BNO08x bno;

void setup() {
  Wire.begin(21, 22); // SDA, SCL
  WiFi.begin("SSID", "PASSWORD");
  while (WiFi.status() != WL_CONNECTED) delay(100);
  udp.begin(4444);
  bno.begin_I2C();
  bno.enableReport(SH2_ARVR_STABILIZED_GRV, 10000); // 100Hz
}

void loop() {
  sh2_SensorValue_t val;
  if (bno.getSensorEvent(&val)) {
    // Pack quaternion into UDP packet and send to PC
    float quat[4] = {
      val.un.arvrStabilizedGameRotationVector.real,
      val.un.arvrStabilizedGameRotationVector.i,
      val.un.arvrStabilizedGameRotationVector.j,
      val.un.arvrStabilizedGameRotationVector.k
    };
    udp.beginPacket("192.168.1.100", 4444);
    udp.write((uint8_t*)quat, 16); // 4 floats × 4 bytes
    udp.endPacket();
  }
}
```

### Python Receiver (on PC)
```python
import socket, struct

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(("0.0.0.0", 4444))

while True:
    data, addr = sock.recvfrom(16)
    qw, qx, qy, qz = struct.unpack('ffff', data)
    print(f"Quaternion: w={qw:.3f} x={qx:.3f} y={qy:.3f} z={qz:.3f}")
```

### Skeleton Solving from Quaternions
Once you have per-segment quaternions, you need to:
1. Define a skeleton hierarchy (parent-child joint relationships)
2. Apply each quaternion to its corresponding joint in the hierarchy
3. Use forward kinematics to compute world-space joint positions
4. Output as BVH (for Blender) or stream via OSC/WebSocket to animation software
