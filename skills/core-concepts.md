# FFmpeg Core Concepts

## Command Structure

Every FFmpeg command follows this pattern:

```
ffmpeg [global options] [input options] -i input [output options] output
```

**Order matters.** Options placed **before** `-i` apply to the input. Options placed **after** apply to the output.

```bash
# Input option (seek input before reading — fast)
ffmpeg -ss 00:00:30 -i input.mp4 output.mp4

# Output option (seek after reading — frame-accurate but slower)
ffmpeg -i input.mp4 -ss 00:00:30 output.mp4
```

---

## Anatomy of a Command

```bash
ffmpeg -y -i input.mov -c:v h264_nvenc -pix_fmt yuv420p -b:v 8M output.mp4
#  │    │      │              │               │               │       │
#  │    │      │              │               │               │       └─ output file
#  │    │      │              │               │               └─ target bitrate 8 Mbps
#  │    │      │              │               └─ pixel format (web compat)
#  │    │      │              └─ video codec: NVIDIA GPU H.264
#  │    │      └─ input file
#  │    └─ overwrite output without asking
#  └─ ffmpeg binary
```

---

## Streams

A video file contains multiple **streams**:
- **Video stream** (`:v`) — the picture
- **Audio stream** (`:a`) — the sound
- **Subtitle stream** (`:s`) — optional
- **Data stream** (`:d`) — metadata, timecode

Address specific streams with stream specifiers:
```bash
-c:v        # video codec
-c:a        # audio codec
-c:v:0      # first video stream only
-c:a:1      # second audio stream only
-map 0:v    # map all video streams from input 0
-map 0:a:0  # map first audio stream from input 0
```

---

## Containers vs. Codecs

**Container** = the wrapper file format (`.mp4`, `.mov`, `.mkv`, `.mxf`)
**Codec** = how the video/audio data is compressed inside the container

```
.mp4 container can hold: H.264, H.265, AV1, AAC, MP3
.mov container can hold: ProRes, H.264, HEVC, PCM audio
.mkv container can hold: almost anything
```

The file extension sets the container. The `-c:v` flag sets the codec.

```bash
# H.264 video in an MKV container
ffmpeg -i input.mp4 -c:v libx264 output.mkv

# ProRes video in a MOV container
ffmpeg -i input.mp4 -c:v prores_ks -profile:v 3 output.mov
```

---

## Pixel Formats

Pixel format defines how color is stored.

| Format | Chroma Subsampling | Bit Depth | Use Case |
|--------|-------------------|-----------|---------|
| `yuv420p` | 4:2:0 | 8-bit | Web, streaming, broad compatibility |
| `yuv422p` | 4:2:2 | 8-bit | Broadcast, editing |
| `yuv444p` | 4:4:4 | 8-bit | VFX, no color compression |
| `yuv420p10le` | 4:2:0 | 10-bit | HDR streaming (H.265) |
| `yuv422p10le` | 4:2:2 | 10-bit | ProRes, DNxHR |
| `gbrpf32le` | — | 32-bit float | EXR, linear VFX |

**Most important rule:** Add `-pix_fmt yuv420p` for any web/player output.
Without it, some browsers and players won't play the file.

```bash
ffmpeg -i input.mov -pix_fmt yuv420p output.mp4
```

---

## Quality Control

### CRF (Constant Rate Factor) — CPU encoders
Lower = better quality, larger file. No target bitrate — quality is constant.

| CRF | Quality | Use Case |
|-----|---------|---------|
| 0 | Lossless | Archive only — huge files |
| 18 | Near-lossless | High-quality archive |
| 23 | Default | Good balance (H.264 default) |
| 28 | Acceptable | Smaller file, visible quality loss |
| 51 | Worst | Don't use |

```bash
ffmpeg -i input.mp4 -c:v libx264 -crf 18 output.mp4
```

### CQ (Constant Quality) — NVENC GPU encoders
Same concept as CRF but for NVENC. Range 0–51.

```bash
ffmpeg -i input.mp4 -c:v h264_nvenc -cq 23 output.mp4
```

### Bitrate Control
Fixed target bitrate — useful when file size matters more than exact quality.

```bash
ffmpeg -i input.mp4 -c:v libx264 -b:v 5M output.mp4   # 5 Megabits/sec
ffmpeg -i input.mp4 -c:v libx264 -b:v 500K output.mp4  # 500 Kilobits/sec
```

---

## Timestamps & Duration

| Format | Example | Notes |
|--------|---------|-------|
| `HH:MM:SS` | `00:01:30` | 1 minute 30 seconds |
| `HH:MM:SS.mmm` | `00:01:30.500` | With milliseconds |
| Seconds | `90` | 90 seconds |
| Seconds.ms | `90.5` | 90.5 seconds |

```bash
-ss 00:01:30      # start at 1m30s
-t 00:00:10       # duration: 10 seconds
-to 00:02:00      # end at 2m00s (not duration)
```

---

## Getting File Information

```bash
# Full file info (streams, codec, duration, bitrate)
ffprobe -v quiet -print_format json -show_streams input.mp4

# Simple one-line summary
ffmpeg -i input.mp4

# Duration only
ffprobe -v quiet -show_entries format=duration -of csv=p=0 input.mp4
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `No such file or directory` | Wrong path or spaces in filename | Wrap filename in quotes |
| `Encoder not found` | Codec not compiled in your FFmpeg build | Use a full FFmpeg build; check `-encoders` |
| `Invalid option -cq` | `-cq` is NVENC-only | Use `-crf` for CPU encoders |
| `yuv444p not supported` | Player can't decode 4:4:4 | Add `-pix_fmt yuv420p` |
| `Non-monotonous DTS` | Timestamps out of order (concat issue) | Add `-vsync vfr` or fix source |
| `NVENC not available` | No NVIDIA GPU or wrong FFmpeg build | Use CPU encoder (`libx264`) or install CUDA-enabled FFmpeg |
| File plays but no sound | Audio stream missing or wrong codec | Check with `ffprobe`; add `-c:a aac` |
