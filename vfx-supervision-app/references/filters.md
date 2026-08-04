# Filters & Effects Reference

## How Filters Work

Filters are applied with `-vf` (video) or `-af` (audio). Chain multiple filters with commas.

```bash
# Single filter
ffmpeg -i input.mp4 -vf scale=1920:1080 output.mp4

# Chain: scale then add padding
ffmpeg -i input.mp4 -vf "scale=1920:1080,pad=1920:1080:0:0" output.mp4
```

For complex multi-input filters, use `-filter_complex`.

---

## Scale (Resize)

```bash
# Exact resolution
ffmpeg -i input.mp4 -vf scale=1920:1080 output.mp4

# Half size (maintain aspect ratio)
ffmpeg -i input.mp4 -vf scale=iw/2:ih/2 output.mp4

# Set width, auto height (keeps aspect ratio)
ffmpeg -i input.mp4 -vf scale=1280:-2 output.mp4

# Set height, auto width
ffmpeg -i input.mp4 -vf scale=-2:720 output.mp4

# Downscale only (don't upscale small files)
ffmpeg -i input.mp4 -vf "scale='min(1920,iw)':'min(1080,ih)'" output.mp4
```

**Note:** Use `-2` (not `-1`) to ensure dimensions are divisible by 2 (required for most codecs).

---

## Crop

```bash
# Crop to 1280x720 from center
ffmpeg -i input.mp4 -vf "crop=1280:720" output.mp4

# Crop with offset (width:height:x:y)
ffmpeg -i input.mp4 -vf "crop=1280:720:100:50" output.mp4

# Remove black bars (auto-detect)
ffmpeg -i input.mp4 -vf "cropdetect" -f null -    # Step 1: find values
ffmpeg -i input.mp4 -vf "crop=1270:536:5:72" output.mp4  # Step 2: apply
```

---

## Speed

### Speed Up Video
```bash
# 2× speed (PTS = Presentation TimeStamp; 0.5× PTS = 2× speed)
ffmpeg -i input.mp4 -filter:v "setpts=0.5*PTS" output.mp4

# 4× speed
ffmpeg -i input.mp4 -filter:v "setpts=0.25*PTS" output.mp4
```

### Slow Down Video
```bash
# 0.5× speed (half speed)
ffmpeg -i input.mp4 -filter:v "setpts=2.0*PTS" output.mp4
```

### Speed Up Video AND Audio Together
```bash
# 2× speed with audio pitch correction
ffmpeg -i input.mp4 \
  -filter:v "setpts=0.5*PTS" \
  -filter:a "atempo=2.0" \
  output.mp4
```

**atempo range:** 0.5–2.0 only. For >2× speed, chain it:
```bash
# 4× speed audio
-filter:a "atempo=2.0,atempo=2.0"
```

---

## Frame Rate

```bash
# Convert to 30fps
ffmpeg -i input.mp4 -r 30 output.mp4

# Convert to 24fps
ffmpeg -i input.mp4 -r 24 output.mp4

# Interpolate to 60fps (smooth slow motion)
ffmpeg -i input.mp4 -vf "minterpolate=fps=60:mi_mode=mci" output.mp4
```

---

## Rotation & Flip

```bash
# Rotate 90° clockwise
ffmpeg -i input.mp4 -vf "transpose=1" output.mp4

# Rotate 90° counter-clockwise
ffmpeg -i input.mp4 -vf "transpose=2" output.mp4

# Rotate 180°
ffmpeg -i input.mp4 -vf "transpose=1,transpose=1" output.mp4

# Flip horizontally (mirror)
ffmpeg -i input.mp4 -vf "hflip" output.mp4

# Flip vertically
ffmpeg -i input.mp4 -vf "vflip" output.mp4
```

---

## Fade In / Out

```bash
# Fade in: 1 second from start
ffmpeg -i input.mp4 -vf "fade=t=in:st=0:d=1" output.mp4

# Fade out: last 2 seconds (if video is 30s, start fade at 28s)
ffmpeg -i input.mp4 -vf "fade=t=out:st=28:d=2" output.mp4

# Both fade in and out
ffmpeg -i input.mp4 -vf "fade=t=in:st=0:d=1,fade=t=out:st=28:d=2" output.mp4
```

---

## Padding / Letterbox / Pillarbox

```bash
# Add black bars to fit 16:9 (letterbox a vertical video)
ffmpeg -i input.mp4 -vf "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" output.mp4

# Scale to fit within 1920×1080 then pad to fill
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  output.mp4
```

---

## Watermark / Text Overlay

```bash
# Static image watermark (bottom-right)
ffmpeg -i input.mp4 -i watermark.png \
  -filter_complex "[0:v][1:v]overlay=W-w-10:H-h-10" \
  output.mp4

# Text burned in
ffmpeg -i input.mp4 \
  -vf "drawtext=text='MY TEXT':fontcolor=white:fontsize=48:x=50:y=50" \
  output.mp4

# Text with timestamp (timecode burn-in)
ffmpeg -i input.mp4 \
  -vf "drawtext=text='%{pts\:hms}':fontcolor=yellow:fontsize=36:x=10:y=10" \
  output.mp4
```

---

## Color Correction (Basic)

```bash
# Brightness, contrast, saturation
ffmpeg -i input.mp4 -vf "eq=brightness=0.1:contrast=1.2:saturation=1.5" output.mp4

# Curves (basic S-curve)
ffmpeg -i input.mp4 -vf "curves=preset=strong_contrast" output.mp4

# Apply a LUT (.cube file)
ffmpeg -i input.mp4 -vf "lut3d=filename=mygrade.cube" output.mp4
```

---

## Deinterlace

```bash
# Yadif (most common deinterlacer)
ffmpeg -i input.mp4 -vf yadif output.mp4

# Send field (high quality, slower)
ffmpeg -i input.mp4 -vf "sendcmd=filename=test.txt,yadif" output.mp4
```

---

## Denoise

```bash
# hqdn3d (fast, decent quality)
ffmpeg -i input.mp4 -vf "hqdn3d" output.mp4

# nlmeans (slower, better quality)
ffmpeg -i input.mp4 -vf "nlmeans" output.mp4
```

---

## Sharpen

```bash
ffmpeg -i input.mp4 -vf "unsharp=5:5:1.5" output.mp4
# Parameters: luma_x:luma_y:luma_amount (positive = sharpen, negative = blur)
```
