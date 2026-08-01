"""
VFX Element Library Auditor
============================
Scans a directory recursively and produces:
  - A printed summary report
  - audit_report.csv   (every file, fully described)
  - audit_sequences.csv (image sequences collapsed to one row each)
  - audit_summary.txt  (human-readable overview)

Usage:
    python audit_library.py "D:/Your/Elements/Folder"

If no path is given it will prompt you.
"""

import os
import re
import sys
import csv
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

# File extensions recognised as VFX elements
VIDEO_EXTS = {".mov", ".mp4", ".avi", ".mxf", ".mkv", ".wmv", ".m4v", ".webm"}
IMAGE_EXTS = {".exr", ".dpx", ".tiff", ".tif", ".png", ".jpg", ".jpeg",
              ".tga", ".hdr", ".cin", ".sgi"}
AUDIO_EXTS = {".wav", ".aiff", ".aif", ".mp3", ".flac"}
PROJECT_EXTS = {".nk", ".aep", ".hip", ".blend", ".ma", ".mb", ".c4d"}
SKIP_DIRS = {"_PROXIES", "_THUMBNAILS", "_METADATA", ".git", "__pycache__", "Thumbs.db"}

# Regex to detect frame numbers at the end of a filename stem
# Matches: name.0001, name_0001, name0001
FRAME_RE = re.compile(r'^(.*?)[\._]?(\d{2,8})$')


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def human_size(num_bytes):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num_bytes < 1024:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024
    return f"{num_bytes:.1f} PB"


def classify_ext(ext):
    ext = ext.lower()
    if ext in VIDEO_EXTS:
        return "VIDEO"
    if ext in IMAGE_EXTS:
        return "IMAGE"
    if ext in AUDIO_EXTS:
        return "AUDIO"
    if ext in PROJECT_EXTS:
        return "PROJECT"
    return "OTHER"


def get_ffprobe_info(filepath):
    """Try to get duration/resolution via ffprobe. Returns dict or None."""
    import subprocess
    try:
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_streams", "-show_format",
            str(filepath)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)
        info = {}
        # Duration
        fmt = data.get("format", {})
        info["duration_sec"] = round(float(fmt.get("duration", 0)), 2)
        # Video stream
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                info["width"] = stream.get("width", "")
                info["height"] = stream.get("height", "")
                # Frame rate
                r_frame_rate = stream.get("r_frame_rate", "")
                if "/" in r_frame_rate:
                    num, den = r_frame_rate.split("/")
                    try:
                        info["fps"] = round(int(num) / int(den), 3)
                    except ZeroDivisionError:
                        info["fps"] = ""
                info["codec"] = stream.get("codec_name", "")
                info["pix_fmt"] = stream.get("pix_fmt", "")
                break
        return info
    except Exception:
        return None


# ---------------------------------------------------------------------------
# SEQUENCE DETECTION
# ---------------------------------------------------------------------------

def group_sequences(files_in_dir):
    """
    Given a list of (filename, full_path, size) tuples from ONE directory,
    group files that look like image sequence frames.
    Returns:
        sequences  - list of dicts describing each sequence
        singletons - list of (filename, full_path, size) for non-sequence files
    """
    # Group by (base_name, extension)
    groups = defaultdict(list)
    singletons = []

    for fname, fpath, fsize in files_in_dir:
        stem = Path(fname).stem
        ext = Path(fname).suffix.lower()
        if ext not in IMAGE_EXTS:
            singletons.append((fname, fpath, fsize))
            continue
        m = FRAME_RE.match(stem)
        if m:
            base, frame_num = m.group(1), m.group(2)
            groups[(base, ext)].append((int(frame_num), fname, fpath, fsize))
        else:
            singletons.append((fname, fpath, fsize))

    sequences = []
    for (base, ext), frames in groups.items():
        if len(frames) < 2:
            # Single numbered file — treat as singleton
            _, fname, fpath, fsize = frames[0]
            singletons.append((fname, fpath, fsize))
            continue
        frames.sort(key=lambda x: x[0])
        frame_nums = [f[0] for f in frames]
        total_size = sum(f[3] for f in frames)
        first_frame_path = frames[0][2]
        sequences.append({
            "base_name": base,
            "extension": ext,
            "first_frame": frame_nums[0],
            "last_frame": frame_nums[-1],
            "frame_count": len(frames),
            "missing_frames": sorted(
                set(range(frame_nums[0], frame_nums[-1] + 1)) - set(frame_nums)
            ),
            "total_size_bytes": total_size,
            "first_frame_path": first_frame_path,
            "directory": str(Path(first_frame_path).parent),
        })

    return sequences, singletons


# ---------------------------------------------------------------------------
# MAIN SCAN
# ---------------------------------------------------------------------------

def scan_library(root_path):
    root = Path(root_path).resolve()
    if not root.exists():
        print(f"ERROR: Path does not exist: {root}")
        sys.exit(1)

    print(f"\nScanning: {root}")
    print("This may take a while for large libraries...\n")

    all_files = []         # raw file records
    all_sequences = []     # collapsed sequence records
    all_singletons = []    # non-sequence file records

    # Walk the tree
    for dirpath, dirnames, filenames in os.walk(root):
        # Skip internal/generated directories
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        dir_files = []
        for fname in filenames:
            fpath = Path(dirpath) / fname
            try:
                fsize = fpath.stat().st_size
            except OSError:
                fsize = 0
            dir_files.append((fname, str(fpath), fsize))
            all_files.append((fname, str(fpath), fsize))

        seqs, singles = group_sequences(dir_files)
        all_sequences.extend(seqs)
        all_singletons.extend(singles)

    return all_files, all_sequences, all_singletons


# ---------------------------------------------------------------------------
# REPORTING
# ---------------------------------------------------------------------------

def build_reports(root_path, all_files, all_sequences, all_singletons, run_ffprobe=False):
    root = Path(root_path).resolve()
    out_dir = Path(".")

    # ---- Stats ----
    ext_counts = defaultdict(int)
    ext_sizes  = defaultdict(int)
    cat_counts = defaultdict(int)
    cat_sizes  = defaultdict(int)
    total_size = 0

    for fname, fpath, fsize in all_files:
        ext = Path(fname).suffix.lower()
        cat = classify_ext(ext)
        ext_counts[ext] += 1
        ext_sizes[ext]  += fsize
        cat_counts[cat] += 1
        cat_sizes[cat]  += fsize
        total_size      += fsize

    # ---- Print summary ----
    sep = "-" * 60
    lines = []
    lines.append("=" * 60)
    lines.append("  VFX ELEMENT LIBRARY AUDIT REPORT")
    lines.append(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"  Root:      {root}")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"  TOTAL FILES:      {len(all_files):,}")
    lines.append(f"  TOTAL SIZE:       {human_size(total_size)}")
    lines.append(f"  IMAGE SEQUENCES:  {len(all_sequences):,}  (collapsed from individual frames)")
    lines.append(f"  SINGLE FILES:     {len(all_singletons):,}")
    lines.append("")
    lines.append(sep)
    lines.append("  BY CATEGORY")
    lines.append(sep)
    for cat in sorted(cat_counts):
        lines.append(f"  {cat:<12} {cat_counts[cat]:>7,} files   {human_size(cat_sizes[cat]):>10}")
    lines.append("")
    lines.append(sep)
    lines.append("  BY EXTENSION")
    lines.append(sep)
    for ext in sorted(ext_counts, key=lambda x: -ext_counts[x]):
        lines.append(f"  {ext:<12} {ext_counts[ext]:>7,} files   {human_size(ext_sizes[ext]):>10}")
    lines.append("")
    lines.append(sep)
    lines.append("  IMAGE SEQUENCES WITH MISSING FRAMES")
    lines.append(sep)
    broken = [s for s in all_sequences if s["missing_frames"]]
    if broken:
        for s in broken:
            missing_str = str(s["missing_frames"][:10])
            if len(s["missing_frames"]) > 10:
                missing_str += f" ... (+{len(s['missing_frames'])-10} more)"
            lines.append(f"  {s['base_name']}{s['extension']}  [{s['first_frame']}-{s['last_frame']}]")
            lines.append(f"    Missing: {missing_str}")
            lines.append(f"    Path: {s['directory']}")
    else:
        lines.append("  None found — all sequences appear complete.")
    lines.append("")
    lines.append("=" * 60)

    report_text = "\n".join(lines)
    print(report_text)

    summary_path = out_dir / "audit_summary.txt"
    summary_path.write_text(report_text, encoding="utf-8")
    print(f"\nSummary saved: {summary_path.resolve()}")

    # ---- CSV: all raw files ----
    csv_all_path = out_dir / "audit_report.csv"
    with open(csv_all_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "filename", "extension", "category", "size_bytes", "size_human",
            "relative_path", "full_path"
        ])
        for fname, fpath, fsize in sorted(all_files, key=lambda x: x[1]):
            ext = Path(fname).suffix.lower()
            rel = str(Path(fpath).relative_to(root))
            writer.writerow([
                fname,
                ext,
                classify_ext(ext),
                fsize,
                human_size(fsize),
                rel,
                fpath,
            ])
    print(f"Full file list saved: {csv_all_path.resolve()}")

    # ---- CSV: sequences ----
    csv_seq_path = out_dir / "audit_sequences.csv"
    with open(csv_seq_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "base_name", "extension", "first_frame", "last_frame",
            "frame_count", "missing_frame_count", "total_size_bytes",
            "total_size_human", "directory", "first_frame_path",
            "width", "height", "fps", "codec", "pix_fmt", "duration_sec"
        ])
        for s in sorted(all_sequences, key=lambda x: x["directory"]):
            probe = {}
            if run_ffprobe:
                probe = get_ffprobe_info(s["first_frame_path"]) or {}
            writer.writerow([
                s["base_name"],
                s["extension"],
                s["first_frame"],
                s["last_frame"],
                s["frame_count"],
                len(s["missing_frames"]),
                s["total_size_bytes"],
                human_size(s["total_size_bytes"]),
                s["directory"],
                s["first_frame_path"],
                probe.get("width", ""),
                probe.get("height", ""),
                probe.get("fps", ""),
                probe.get("codec", ""),
                probe.get("pix_fmt", ""),
                probe.get("duration_sec", ""),
            ])
    print(f"Sequence list saved: {csv_seq_path.resolve()}")

    # ---- CSV: single video/image files ----
    csv_singles_path = out_dir / "audit_singles.csv"
    with open(csv_singles_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "filename", "extension", "category", "size_bytes", "size_human",
            "relative_path", "width", "height", "fps", "codec",
            "pix_fmt", "duration_sec"
        ])
        for fname, fpath, fsize in sorted(all_singletons, key=lambda x: x[1]):
            ext = Path(fname).suffix.lower()
            cat = classify_ext(ext)
            rel = str(Path(fpath).relative_to(root))
            probe = {}
            if run_ffprobe and cat in ("VIDEO", "IMAGE"):
                probe = get_ffprobe_info(fpath) or {}
            writer.writerow([
                fname,
                ext,
                cat,
                fsize,
                human_size(fsize),
                rel,
                probe.get("width", ""),
                probe.get("height", ""),
                probe.get("fps", ""),
                probe.get("codec", ""),
                probe.get("pix_fmt", ""),
                probe.get("duration_sec", ""),
            ])
    print(f"Singles list saved: {csv_singles_path.resolve()}")
    print("\nDone.\n")


# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) >= 2:
        library_root = sys.argv[1]
    else:
        library_root = input("Enter the path to your element library: ").strip().strip('"')

    # Set run_ffprobe=True to also extract resolution/fps/codec from every file.
    # This is accurate but SLOW on large libraries. Leave False for a fast first pass.
    RUN_FFPROBE = "--ffprobe" in sys.argv

    if RUN_FFPROBE:
        print("ffprobe mode enabled — this will be slow but gives full metadata.")

    all_files, all_sequences, all_singletons = scan_library(library_root)
    build_reports(library_root, all_files, all_sequences, all_singletons, run_ffprobe=RUN_FFPROBE)
