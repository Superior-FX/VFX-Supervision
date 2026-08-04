# Camera Department Reference Sheet

## Table of Contents
1. [Purpose](#purpose)
2. [DP Contact Block](#dp-contact-block)
3. [Per-Camera-Body Spec Block](#per-camera-body-spec-block)
4. [Why VFX Needs This](#why-vfx-needs-this)

## Purpose

A template for the information a VFX supervisor should collect from the
DP and camera department during prep — either directly or via the DIT.
Missing any of this at prep tends to surface as a matchmove, color, or
conform problem in post.

## DP Contact Block

- Name and contact info (email/phone, plus 1st AC as backup contact)
- Preferred camera body/bodies
- Preferred lens package
- Preferred on-set monitoring LUT

## Per-Camera-Body Spec Block

Capture this per camera (A-cam, B-cam, etc. — specs often differ body to
body even on the same show):

- **Model** — e.g. ARRI Alexa 35, Sony Venice 2, RED V-Raptor
- **Codec** — e.g. ARRIRAW, X-OCN, REDCODE RAW
- **Resolution** — capture resolution and sensor mode (e.g. 4.6K Open
  Gate vs. 4K 16:9)
- **Sensor mode** — open gate vs. windowed; affects available
  reframe/stabilization latitude in post
- **Frame rate** — base frame rate and any off-speed rates used
  (slow-mo, ramps)
- **Media** — recording media type (for data wrangling/DIT logistics)
- **Color space** — camera native color space/gamut (e.g. ARRI LogC4 /
  AWG4)
- **Monitoring LUT** — filename of the on-set viewing LUT, and where it's
  distributed from (DIT cart, video village)
- **Bit depth** — recording bit depth (12-bit, 16-bit)

## Why VFX Needs This

- **Matchmove/tracking** — sensor mode and resolution affect the
  available reframe latitude and lens distortion calibration.
- **Color pipeline** — camera native color space and monitoring LUT
  determine the IDT/working colorspace decisions made in
  [Colorspace & Camera Prep](colorspace.md).
- **Conform** — mixed camera bodies/codecs on one show need conform notes
  so online doesn't silently mismatch color spaces between cameras.
- **DIT handoff** — this block usually lives with the DIT day-to-day;
  getting it in writing during prep avoids chasing it down mid-shoot.
