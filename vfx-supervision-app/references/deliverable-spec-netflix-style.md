# Streamer Deliverable Spec Reference (Netflix-Style IMF)

## Table of Contents
1. [How to Use This](#how-to-use-this)
2. [Video Deliverables](#video-deliverables)
3. [Audio Deliverables](#audio-deliverables)
4. [Localization & Accessibility](#localization--accessibility)
5. [IMF Packaging Notes](#imf-packaging-notes)
6. [Per-Distributor Differences](#per-distributor-differences)

## How to Use This

Major streamers (Netflix, Amazon, Apple TV+, Disney+, HBO Max) each publish a
partner/technical delivery spec that's revised periodically. This doc is a
**field checklist** for the categories of information a deliverable spec
will ask for — not a substitute for the current PDF from the actual
distributor on your show. Always pull the live spec sheet from the
distributor's partner help center before finals and confirm nothing has
changed since prep.

## Video Deliverables

- **Master format** — IMF (Interoperable Master Format) is the standard
  packaging for streamer finals; some still accept ProRes 4444 XQ or DPX
  sequence masters for legacy workflows.
- **Resolution** — native capture/finish resolution (e.g. 4K DCI
  4096×2160, UHD 3840×2160), confirm required deliverable resolution
  independent of finish resolution.
- **Frame rate** — project frame rate and whether off-speed/VFR sources
  need conform notes.
- **Colorimetry** — color space and transfer function for the deliverable
  (e.g. Rec.2020 PQ for HDR, Rec.709 for SDR), distinct from the working/
  finishing colorspace (ACES, etc.).
- **Dynamic range / HDR** — SDR, HDR10, Dolby Vision, HDR10+; each has its
  own mastering and metadata requirements.
- **JPEG2000 profile** — bitrate/profile requirements for the IMF
  essence (broadcast profile vs. higher-bitrate profiles).
- **Mastering display metadata** — max/min luminance, color primaries of
  the reference display used to master HDR.
- **Bit depth & chroma subsampling** — typically 16-bit float for VFX/
  finishing intermediates, 10/12-bit for delivery masters.
- **Aspect ratio / framing** — protection for multiple aspect ratios
  (theatrical vs. streaming crop) if applicable.

## Audio Deliverables

- **Mix formats required** — Dolby Atmos (object-based), 5.1, and 2.0
  stereo are commonly all required as separate deliverables.
- **Loudness targets** — dialogue-gated loudness spec (commonly around
  -27 LKFS for streaming, but confirm the current number per distributor)
  and true-peak ceiling.
- **Stems** — dialogue, music, and effects (M&E) stems delivered
  separately for dubbing/localization, in addition to the final mix.
- **Sync/embedding** — audio embedded in the IMF package vs. delivered as
  separate WAV/MXF files, sample rate and bit depth requirements.

## Localization & Accessibility

- **Subtitles/captions** — closed captions (SDH) and forced narratives,
  typically delivered as timed-text (IMSC/TTML) files per language.
- **Dubs** — foreign-language audio tracks, delivered against the M&E
  stems.
- **Audio description** — a narrated track describing key visual action
  for accessibility, often a separate deliverable with its own mix specs.
- **Territory-specific versions** — content or runtime differences
  required for specific territories (edits, card replacements, disclaimers).

## IMF Packaging Notes

- IMF packages are composition-based: a Composition Playlist (CPL)
  references shared essence (video/audio track files), so multiple
  versions (theatrical cut, TV cut, different languages) can share
  common media without duplicating full masters.
- Deliverable QC typically checks CPL validity, essence conformance,
  and that all referenced track files are present and playable.

## Per-Distributor Differences

Treat the categories above as universal; the actual numbers (loudness
targets, HDR mastering requirements, JPEG2000 bitrate profiles, caption
formats) vary by distributor and change over time. Build the habit of:

1. Pulling the current spec PDF from the distributor's partner portal at
   the start of post.
2. Circulating it to color, sound, and conform leads before locking
   pipeline decisions.
3. Re-checking it before finals — specs are revised more often than
   productions expect.
