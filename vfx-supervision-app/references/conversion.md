# Conversion & Compression Reference

## Basic Conversion

```bash
# Auto-detect everything — FFmpeg guesses codec from extension
ffmpeg -i input.mov output.mp4
ffmpeg -i input.mp4 output.mkv
ffmpeg -i input.avi output.mov
```

FFmpeg selects the default codec for the output container automatically.
For production work, always specify the codec explicitly.

---

## CPU Encoders

### H.264 (libx264) — Most Compatible
```bash
ffmpeg -i input.mov -c:v libx264 -crf 23 -pix_fmt yuv420p output.mp4
```

| Preset | Speed | File Size | Use Case |
|--------|-------|-----------|---------|
| `ultrafast` | Fastest | Largest | Preview/proxy only |
| `fast` | Fast | Large | Quick renders |
| `medium` | Balanced | Medium | Default |
| `slow` | Slow | Smaller | Archive |
| `veryslow` | Slowest | Smallest | Best compression |

```bash
ffmpeg -i input.mov -c:v libx264 -preset slow -crf 18 output.mp4
```

### H.265/HEVC (libx265) — ~50% Smaller than H.264
```bash
ffmpeg -i input.mov -c:v libx265 -crf 28 -pix_fmt yuv420p output.mp4
```
Note: CRF 28 in HEVC ≈ CRF 23 in H.264 (same visual quality, smaller file).

### AV1 (libaom-av1 or libsvtav1) — Best Compression
```bash
# Slow but excellent quality
ffmpeg -i input.mov -c:v libaom-av1 -crf 30 -b:v 0 output.mp4

# Faster (SVT-AV1)
ffmpeg -i input.mov -c:v libsvtav1 -crf 30 output.mp4
```

---

## GPU Encoders (NVIDIA NVENC)

**Check available NVENC encoders:**
```bash
ffmpeg -encoders | findstr nvenc    # Windows
ffmpeg -encoders | grep nvenc       # Mac/Linux
```

### H.264 NVENC — Fastest, Most Compatible
```bash
ffmpeg -i input.mov -c:v h264_nvenc -pix_fmt yuv420p output.mp4 -y
```

### HEVC NVENC — Smaller Files
```bash
ffmpeg -i input.mov -c:v hevc_nvenc -pix_fmt yuv420p output.mp4 -y
```

### AV1 NVENC — Best Compression (RTX 4000 only)
```bash
ffmpeg -i input.mov -c:v av1_nvenc -pix_fmt yuv420p output.mp4 -y
```

### NVENC Quality Settings
```bash
# Quality-based (CQ — lower = better, 0–51)
ffmpeg -i input.mov -c:v h264_nvenc -cq 20 output.mp4

# Preset (p1=fastest, p7=slowest/best)
ffmpeg -i input.mov -c:v h264_nvenc -preset p7 -cq 23 output.mp4

# Bitrate target
ffmpeg -i input.mov -c:v h264_nvenc -b:v 8M output.mp4
```

### NVENC vs CPU — When to Use Which
| Scenario | Use |
|----------|-----|
| Fastest possible encode | NVENC (GPU) |
| Smallest possible file | CPU (libx265 or libaom) |
| Streaming / web delivery | NVENC h264_nvenc |
| Archive / master | CPU libx264 CRF 18 |
| Long queue of files overnight | CPU (better quality/size) |

---

## ProRes (macOS / Professional)

```bash
# ProRes 422 HQ (editorial quality)
ffmpeg -i input.mov -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le output.mov

# ProRes 4444 (with alpha)
ffmpeg -i input.mov -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le output.mov
```

| Profile | Value | Notes |
|---------|-------|-------|
| ProRes 422 Proxy | 0 | Offline editing proxy |
| ProRes 422 LT | 1 | Lightweight editorial |
| ProRes 422 | 2 | Standard editorial |
| ProRes 422 HQ | 3 | High quality editorial |
| ProRes 4444 | 4 | VFX, with alpha |
| ProRes 4444 XQ | 5 | Highest quality |

---

## DNxHR / DNxHD (Avid)

```bash
# DNxHR HQX (4K, 10-bit)
ffmpeg -i input.mov -c:v dnxhd -profile:v dnxhr_hqx -pix_fmt yuv422p10le output.mxf

# DNxHD 1080p
ffmpeg -i input.mov -c:v dnxhd -b:v 175M output.mxf
```

---

## Lossless Copy (No Re-encode)

When you only need to remux (change container) without touching quality:
```bash
ffmpeg -i input.mov -c copy output.mp4
```
**Instantly fast** — no encoding. Only works if the target container supports the codec.

---

## Two-Pass Encoding (Best Bitrate Accuracy)

For precise file size control:
```bash
# Pass 1 (analysis — no output video)
ffmpeg -i input.mp4 -c:v libx264 -b:v 5M -pass 1 -an -f null NUL

# Pass 2 (actual encode)
ffmpeg -i input.mp4 -c:v libx264 -b:v 5M -pass 2 output.mp4
```

---

## Common Output Targets

### Web / YouTube
```bash
ffmpeg -i input.mov -c:v libx264 -crf 18 -preset slow \
  -pix_fmt yuv420p -c:a aac -b:a 192k output.mp4
```

### Discord / Social (small file)
```bash
ffmpeg -i input.mov -c:v h264_nvenc -cq 28 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -vf scale=1280:-2 output.mp4
```

### High-Quality Archive
```bash
ffmpeg -i input.mov -c:v libx264 -crf 15 -preset veryslow \
  -pix_fmt yuv420p -c:a copy output.mp4
```

### 4K HDR (HEVC 10-bit)
```bash
ffmpeg -i input.mov -c:v libx265 -crf 22 -pix_fmt yuv420p10le \
  -c:a aac -b:a 192k output.mp4
```
