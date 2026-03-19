# Trimming, Cutting & Merging Reference

## Trimming

### Fast Seek (Keyframe Accurate — Recommended for Long Seeks)
Place `-ss` **before** `-i`:
```bash
ffmpeg -ss 00:00:30 -i input.mp4 -t 10 output.mp4
```
Seeks instantly to the nearest keyframe. May be off by up to a few seconds from the exact timestamp.

### Frame-Accurate Trim
Place `-ss` **after** `-i` (slower — reads from start):
```bash
ffmpeg -i input.mp4 -ss 00:00:30 -t 10 output.mp4
```

### Trim by End Timestamp (not duration)
```bash
# Start at 1m, end at 2m30s
ffmpeg -i input.mp4 -ss 00:01:00 -to 00:02:30 output.mp4
```

### Trim Without Re-encoding (Instant)
```bash
ffmpeg -ss 00:00:30 -i input.mp4 -t 10 -c copy output.mp4
```
⚠️ `-c copy` with `-ss` may have a brief black frame at the start — the encoder snaps to the nearest keyframe.

---

## Splitting a File

### Split Into Fixed-Length Chunks
```bash
# Split into 60-second segments
ffmpeg -i input.mp4 -c copy -segment_time 60 -f segment output_%03d.mp4
```

### Split at Specific Points
```bash
# Segment 1: 0–30s
ffmpeg -i input.mp4 -ss 0 -to 00:00:30 -c copy part1.mp4

# Segment 2: 30s–1m10s
ffmpeg -i input.mp4 -ss 00:00:30 -to 00:01:10 -c copy part2.mp4
```

---

## Merging / Concatenating

### Concat Demuxer (Same Codec — Fast, No Re-encode)

**Step 1:** Create a text file listing clips:
```
# file.txt
file 'clip1.mp4'
file 'clip2.mp4'
file 'clip3.mp4'
```

**Step 2:** Merge:
```bash
ffmpeg -f concat -safe 0 -i file.txt -c copy output.mp4
```

**Create the file.txt from command line:**
```bash
# Windows (PowerShell)
"file 'clip1.mp4'", "file 'clip2.mp4'" | Out-File file.txt -Encoding utf8

# Windows (CMD)
echo file 'clip1.mp4' > file.txt
echo file 'clip2.mp4' >> file.txt

# Mac/Linux
printf "file '%s'\n" clip1.mp4 clip2.mp4 > file.txt
```

### Concat Filter (Different Codecs / Resolutions — Re-encodes)
```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 -i clip3.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" output.mp4
```
Use when clips have different resolutions, frame rates, or codecs.

---

## Looping

### Loop a Video N Times
```bash
# Loop video 3 times
ffmpeg -stream_loop 3 -i input.mp4 -c copy output.mp4
```

### Loop an Image to Create a Video
```bash
# Static image held for 10 seconds
ffmpeg -loop 1 -i image.jpg -t 10 -c:v libx264 -pix_fmt yuv420p output.mp4

# With GPU
ffmpeg -loop 1 -i image.jpg -t 10 -c:v h264_nvenc -pix_fmt yuv420p output.mp4
```

### Loop Until Audio Ends
```bash
ffmpeg -loop 1 -i image.jpg -i audio.mp3 -c:v libx264 \
  -tune stillimage -pix_fmt yuv420p -shortest output.mp4
```

---

## Adding / Replacing Audio

### Add Audio to a Silent Video
```bash
ffmpeg -i video.mp4 -i audio.mp3 -c:v copy -c:a aac -shortest output.mp4
```

### Replace Existing Audio
```bash
ffmpeg -i video.mp4 -i new_audio.mp3 -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 output.mp4
```

### Remove Audio
```bash
ffmpeg -i input.mp4 -c:v copy -an output.mp4
```

---

## Overlaying / Picture-in-Picture

```bash
# Overlay small.mp4 in top-right corner of big.mp4
ffmpeg -i big.mp4 -i small.mp4 \
  -filter_complex "[0:v][1:v]overlay=W-w-10:10" \
  output.mp4
```

| Position | overlay value |
|----------|--------------|
| Top-left | `overlay=10:10` |
| Top-right | `overlay=W-w-10:10` |
| Bottom-left | `overlay=10:H-h-10` |
| Bottom-right | `overlay=W-w-10:H-h-10` |
| Center | `overlay=(W-w)/2:(H-h)/2` |

---

## Creating a Slideshow from Images

```bash
# Images named img001.jpg, img002.jpg... at 1 image per second
ffmpeg -framerate 1 -i img%03d.jpg -c:v libx264 -pix_fmt yuv420p slideshow.mp4

# With crossfade (requires filter_complex for complex dissolves)
ffmpeg -framerate 1/3 -i img%03d.jpg -vf "zoompan=z='min(zoom+0.002,1.5)':d=75" \
  -c:v libx264 -pix_fmt yuv420p slideshow.mp4
```
