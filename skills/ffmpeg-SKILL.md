---
name: ffmpeg
description: >
  FFmpeg command reference and workflow guide. Use this skill whenever the user asks
  about FFmpeg commands, video conversion, transcoding, compression, trimming, merging,
  splitting, extracting audio, resizing, screenshotting, batch processing, GPU encoding
  (NVENC, h264_nvenc, hevc_nvenc, av1_nvenc), codec selection, pixel formats, bitrate
  control, filter graphs, or any video/audio processing task using FFmpeg. Trigger even
  for partial matches — e.g. "how do I compress a video", "convert MOV to MP4",
  "extract a frame", "speed up a clip", "loop an image to video", "merge video files".
---

# FFmpeg Skill

Expert FFmpeg reference for video/audio processing. Covers everything from basic
conversion to GPU-accelerated encoding and complex filter graphs.

---

## Domain Map — Which File to Read

| Domain | Reference File | Key Topics |
|--------|---------------|------------|
| Core Concepts & Flags | `references/core-concepts.md` | Command structure, flags, containers, streams |
| Conversion & Compression | `references/conversion.md` | Codecs, GPU encoding, pixel formats, quality control |
| Trimming, Cutting & Merging | `references/trimming-merging.md` | Trim, concat, split, loop |
| Filters & Effects | `references/filters.md` | Scale, speed, crop, overlay, fade, loudnorm |
| Audio | `references/audio.md` | Extract, mix, convert, sync, loudness |
| Batch & Automation | `references/batch.md` | Glob patterns, loops, PowerShell, bash |
| Screenshots & Thumbnails | `references/screenshots.md` | Frame extraction, contact sheets, timelapse |
| VFX / Production Use | `references/vfx-production.md` | EXR sequences, ProRes, log footage, LUT baking |

---

## Quick Reference — Most Common Commands

```bash
# Convert any format
ffmpeg -i input.mov output.mp4

# GPU compress (NVIDIA RTX)
ffmpeg -i input.mov -pix_fmt yuv420p -c:v h264_nvenc output.mp4 -y

# Trim (start 30s, duration 10s)
ffmpeg -i input.mp4 -ss 00:00:30 -t 10 output.mp4

# Extract audio
ffmpeg -i input.mp4 audio.m4a

# Resize to half
ffmpeg -i input.mp4 -vf scale=iw/2:ih/2 output.mp4

# Screenshot at 5s
ffmpeg -i input.mp4 -ss 00:00:05 -frames:v 1 frame.jpg

# Batch convert (GPU)
ffmpeg -i "input%03d.mov" -c:v h264_nvenc "output%03d.mp4"

# Speed up 2x
ffmpeg -i input.mp4 -filter:v "setpts=0.5*PTS" output.mp4

# Loop image to video (10s)
ffmpeg -loop 1 -i image.jpg -t 10 -c:v libx264 output.mp4

# Merge clips from list
ffmpeg -f concat -i file.txt -c copy output.mp4
```

---

## Essential Flags — Always Know These

| Flag | Meaning |
|------|---------|
| `-i` | Input file |
| `-y` | Overwrite output without asking |
| `-c:v` | Video codec |
| `-c:a` | Audio codec |
| `-c copy` | Stream copy — no re-encode (fast) |
| `-vf` | Video filter |
| `-af` | Audio filter |
| `-ss` | Seek to timestamp (start point) |
| `-t` | Duration |
| `-to` | End timestamp |
| `-pix_fmt yuv420p` | Web-compatible pixel format |
| `-crf` | Constant Rate Factor (quality; lower = better) |
| `-b:v` | Target video bitrate |
| `-an` | Remove audio |
| `-vn` | Remove video |
| `-r` | Frame rate |
| `-s` | Resolution (e.g. 1920x1080) |

---

## GPU Encoders (NVIDIA RTX)

| Codec | Encoder Flag | Notes |
|-------|-------------|-------|
| H.264 | `h264_nvenc` | Most compatible; good for web/streaming |
| H.265/HEVC | `hevc_nvenc` | ~50% smaller than H.264 at same quality |
| AV1 | `av1_nvenc` | Best compression; RTX 4000 series only |

**RTX 4090 sweet spot:**
```bash
ffmpeg -i input.mov -c:v h264_nvenc -preset p7 -cq 23 -pix_fmt yuv420p output.mp4
```

---

## Pro Tips

- `-y` = always overwrite; skip the prompt
- Quotes around **any filename with spaces**
- `-pix_fmt yuv420p` = required for broad web/browser compatibility
- Place `-ss` **before** `-i` for fast seek (keyframe accurate); **after** `-i` for frame-accurate
- `-c copy` skips re-encoding — use when you only need to cut/merge without quality loss
- Run `ffmpeg -encoders | findstr nvenc` (Windows) to confirm GPU encoders are available
