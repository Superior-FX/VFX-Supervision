# Audio Reference

## Extract Audio

```bash
# Extract to M4A (AAC — keeps quality, small file)
ffmpeg -i input.mp4 audio.m4a

# Extract to MP3
ffmpeg -i input.mp4 -c:a mp3 -b:a 192k audio.mp3

# Extract to WAV (lossless, uncompressed)
ffmpeg -i input.mp4 -c:a pcm_s16le audio.wav

# Extract without re-encoding (fastest)
ffmpeg -i input.mp4 -vn -c:a copy audio.aac
```

## Audio Conversion

```bash
# MP3 to AAC
ffmpeg -i input.mp3 -c:a aac -b:a 192k output.m4a

# WAV to MP3
ffmpeg -i input.wav -c:a mp3 -b:a 320k output.mp3

# Any audio to FLAC (lossless)
ffmpeg -i input.mp3 output.flac
```

## Audio Normalization

```bash
# Loudnorm (EBU R128 — broadcast standard)
ffmpeg -i input.mp4 -af loudnorm output.mp4

# Specific target loudness
ffmpeg -i input.mp4 -af "loudnorm=I=-16:LRA=11:TP=-1.5" output.mp4
```

## Adjust Volume

```bash
# Double volume
ffmpeg -i input.mp4 -af "volume=2.0" output.mp4

# Half volume
ffmpeg -i input.mp4 -af "volume=0.5" output.mp4

# Increase by 10dB
ffmpeg -i input.mp4 -af "volume=10dB" output.mp4
```

## Delay / Sync Audio

```bash
# Delay audio by 0.5 seconds
ffmpeg -i input.mp4 -af "adelay=500|500" output.mp4

# Advance audio by 0.5s (trim start)
ffmpeg -i input.mp4 -af "atrim=0.5" output.mp4
```

---

# Batch Processing Reference

## Windows PowerShell

```powershell
# Convert all MOV files in folder to MP4 (GPU)
Get-ChildItem *.mov | ForEach-Object {
  ffmpeg -i $_.FullName -c:v h264_nvenc -pix_fmt yuv420p ($_.BaseName + ".mp4") -y
}

# Convert all MP4 to ProRes
Get-ChildItem *.mp4 | ForEach-Object {
  ffmpeg -i $_.FullName -c:v prores_ks -profile:v 3 ($_.BaseName + ".mov") -y
}
```

## Windows CMD

```cmd
for %f in (*.mov) do ffmpeg -i "%f" -c:v h264_nvenc "%~nf.mp4" -y
```

## Numbered Sequence (Image Sequence → Video)

```bash
# Input: frame001.png, frame002.png...
ffmpeg -framerate 24 -i frame%03d.png -c:v libx264 -pix_fmt yuv420p output.mp4

# Input: frame001.exr, frame002.exr... (VFX use)
ffmpeg -framerate 24 -i frame%04d.exr -c:v prores_ks -profile:v 3 output.mov
```

## Batch with file.txt (Concat)

```powershell
# Generate file.txt from all MP4s in folder (PowerShell)
Get-ChildItem *.mp4 | ForEach-Object { "file '$($_.Name)'" } | Out-File file.txt -Encoding utf8
ffmpeg -f concat -safe 0 -i file.txt -c copy merged.mp4
```

---

# Screenshots & Thumbnails Reference

## Single Frame

```bash
# Screenshot at specific time
ffmpeg -i input.mp4 -ss 00:00:05 -frames:v 1 frame.jpg

# PNG (lossless)
ffmpeg -i input.mp4 -ss 00:00:05 -frames:v 1 frame.png

# High quality JPEG
ffmpeg -i input.mp4 -ss 00:00:05 -frames:v 1 -qscale:v 2 frame.jpg
```

## Extract Multiple Frames

```bash
# Every second
ffmpeg -i input.mp4 -vf fps=1 frame_%04d.jpg

# Every 10 seconds
ffmpeg -i input.mp4 -vf fps=1/10 frame_%04d.jpg

# Every frame (all frames)
ffmpeg -i input.mp4 frame_%04d.png
```

## Extract EXR Sequence (VFX)

```bash
# Full quality EXR sequence
ffmpeg -i input.mov -vf "colorspace=all=bt709" frame_%04d.exr
```

## Thumbnail Grid / Contact Sheet

```bash
# 4×4 grid of thumbnails
ffmpeg -i input.mp4 -vf "select='not(mod(n,30))',scale=320:-1,tile=4x4" -frames:v 1 contact.jpg
```

## Video Preview GIF

```bash
# High quality GIF (palette-based)
ffmpeg -i input.mp4 -vf "fps=12,scale=480:-1:flags=lanczos,palettegen" palette.png
ffmpeg -i input.mp4 -i palette.png -vf "fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse" output.gif
```

---

# VFX / Production Use Reference

## EXR Sequences

```bash
# Image sequence to ProRes (VFX plates → editorial)
ffmpeg -framerate 24 -i SC015_010_%04d.exr \
  -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le \
  SC015_010_proxy.mov

# EXR sequence with handles (start at frame 1001)
ffmpeg -framerate 24 -start_number 1001 -i frame_%04d.exr \
  -c:v prores_ks -profile:v 3 SC015_proxy.mov
```

## Log Footage Handling

```bash
# Transcode ARRIRAW / log footage preserving log encoding (no LUT)
ffmpeg -i input_logc.mov -c:v prores_ks -profile:v 3 \
  -pix_fmt yuv422p10le -c:a copy output_logc.mov

# Apply a viewing LUT (for dailies — bakes the look)
ffmpeg -i input.mov -vf "lut3d=show_lut.cube" \
  -c:v prores_ks -profile:v 3 output_dailies.mov
```

## Remux Without Re-encoding

```bash
# MOV → MXF (for Avid ingest)
ffmpeg -i input.mov -c copy output.mxf

# MP4 → MOV
ffmpeg -i input.mp4 -c copy output.mov
```

## Generate Test Signal / Slate

```bash
# SMPTE color bars (10 seconds)
ffmpeg -f lavfi -i smptebars=size=1920x1080:rate=24 -t 10 bars.mp4

# 1kHz tone (for audio sync reference)
ffmpeg -f lavfi -i "sine=frequency=1000:duration=5" tone.wav

# Black slate
ffmpeg -f lavfi -i color=black:size=1920x1080:rate=24 -t 5 black.mp4
```

## Check File Without Playing

```bash
# Full stream info
ffprobe -v quiet -print_format json -show_streams input.mp4

# Quick summary
ffmpeg -i input.mp4 2>&1 | findstr "Stream\|Duration"  # Windows
ffmpeg -i input.mp4 2>&1 | grep -E "Stream|Duration"   # Mac/Linux
```
