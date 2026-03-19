"""
VFX Element Library Ingestion Script
=====================================
Scans source folders, generates thumbnails + proxy videos via FFmpeg,
extracts metadata, and writes JSON sidecars + a master index.json.

Usage:
    python ingest.py                   # full run
    python ingest.py --dry-run         # show what would be processed, no output
    python ingest.py --rebuild-all     # re-generate all thumbnails/proxies even if they exist
    python ingest.py --index-only      # just rebuild index.json from existing metadata
    python ingest.py --workers 8       # override thread count

Output lives in:
    S:\\_POST_PRODUCTION\\_VFX_ELEMENTS\\_LIBRARY_DATA\\
        thumbnails\\   (JPEG stills, 320px wide)
        proxies\\      (H.264 MP4, 512px wide, max 30s)
        metadata\\     (JSON sidecar per element)
        index.json     (flat master list of all elements)
        ingest.log     (errors and warnings)
"""

import os
import re
import sys
import json
import hashlib
import logging
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed


# ── CONFIG ───────────────────────────────────────────────────────────────────

LIBRARY_ROOT = Path(r"S:\_POST_PRODUCTION\_VFX_ELEMENTS")
OUTPUT_ROOT  = LIBRARY_ROOT / "_LIBRARY_DATA"
THUMB_DIR    = OUTPUT_ROOT / "thumbnails"
PROXY_DIR    = OUTPUT_ROOT / "proxies"
META_DIR     = OUTPUT_ROOT / "metadata"
INDEX_PATH   = OUTPUT_ROOT / "index.json"
LOG_PATH     = OUTPUT_ROOT / "ingest.log"

FFMPEG  = r"C:\Users\atomsmasher\Documents\FFmpeg\bin\ffmpeg.exe"
FFPROBE = r"C:\Users\atomsmasher\Documents\FFmpeg\bin\ffprobe.exe"

THUMB_WIDTH      = 320     # thumbnail JPEG width in px (height auto)
PROXY_WIDTH      = 512     # proxy MP4 width in px (height auto, must be even)
PROXY_MAX_DUR    = 30      # cap proxy at this many seconds
PROXY_FPS        = 24      # proxy output frame rate
DEFAULT_WORKERS  = 4       # parallel FFmpeg jobs

# Source folders to scan (relative to LIBRARY_ROOT)
SOURCE_FOLDERS = [
    "_Action VFX",
    "_VideoCoPilot",
    "detonation films",
    "blood",
    "misc VFX Elements",      # includes Sparks, rain, Bullet_Hits, Dust_Hits subdirs
    "Bullet_Hits",
    "Dust_Hits",
    "lens distortions",
    "Sky Library",
    "clouds\uf022smoke",       # U+F022 private-use char — looks like " in Explorer
    "bullet holes in skin",
    "Lens Texture",
    "textures",
    "AdobeStock",
]

VIDEO_EXTS  = {".mov", ".mp4", ".avi", ".mxf", ".mkv", ".m4v", ".qt"}
IMAGE_EXTS  = {".exr", ".dpx", ".tiff", ".tif", ".png", ".tga", ".hdr", ".cin",
               ".jpg", ".jpeg"}
# These image types are worth encoding as proxies (have dynamic range to show)
DYNAMIC_IMG_EXTS = {".exr", ".dpx", ".hdr", ".cin"}

SKIP_DIRS   = {"_LIBRARY_DATA", "__MACOSX", ".git", "_PROXIES", "_THUMBNAILS",
               "_METADATA", "Thumbs.db"}
SKIP_PREFIX = "._"   # macOS resource fork artifacts

# ── CATEGORY DETECTION ───────────────────────────────────────────────────────

# Keywords → category (checked against full path + filename, lowercased)
CATEGORY_KEYWORDS = {
    "FIRE":         ["fire", "flame", "fireball", "burning", "campfire", "ignit",
                     "torch", "blaze", "willyp", "molotov"],
    "SMOKE":        ["smoke", "smok", "vapor", "steam", "exhaust", "billowing",
                     "gunsmoke", "breath", "puff", "lingering"],
    "EXPLOSIONS":   ["explos", "blast", "detonat", "implosion", "burst", "bomb",
                     "airburst", "cannon", "grenade", "midair", "gasoline",
                     "warehouse", "building_imp"],
    "SPARKS":       ["spark", "ember", "shell", "brass", "casing", "steel_shell",
                     "9mm", "308", "762", "40_brass", "hot_metal", "weld"],
    "DUST":         ["dust", "dirt", "sand", "debris", "rubble", "concrete",
                     "debris", "dvdust", "dustfall", "dustwave", "dust_devil",
                     "dust_charge", "powder"],
    "WATER":        ["water", "splash", "rain", "drop", "wave", "flood",
                     "liquid", "drip", "ocean", "underwater"],
    "LIGHTNING":    ["lightning", "electric", "arc_rip", "plasma", "energy",
                     "arcripper", "alien_trace"],
    "MUZZLE_FLASH": ["muzzle", "muzzflash", "gun_smoke", "manzb", "single_muzzle"],
    "BLOOD":        ["blood", "gore", "wound", "splatter", "decap"],
    "ATMOSPHERICS": ["atmosphere", "cloud", "fog", "haze", "mist", "nebula",
                     "atmospheric", "smoke_atmos"],
    "LENS_FX":      ["lens", "flare", "lens_dirt", "light_leak", "bokeh",
                     "aberration", "distortion", "streak", "anamorphic",
                     "lensdirt"],
    "IMPACTS":      ["impact", "hit", "crack", "shatter", "glass", "wall_hit",
                     "couch_hit", "particle_hit", "bullett", "bulletsg",
                     "bulletw", "bwallq"],
    "SHOCKWAVE":    ["shockwave", "shock_wave", "pressure_wave"],
    "GORE":         ["gore", "organ", "viscera"],
    "SKY":          ["sky", "skylib", "mattepaint", "backplate", "cloud_sky"],
    "TEXTURES":     ["texture", "grunge", "burn_mark", "bullet_hole", "lens_tex",
                     "dirt_tex", "crack", "blood_tex", "gore_tex", "fractured_glass"],
}

# ActionVFX folder code prefixes → category
ACTIONVFX_CODES = {
    "BF1":   "EXPLOSIONS",    # Big Fire
    "BGH1":  "SMOKE",         # Big Grey Haze
    "BGS1":  "SMOKE",         # Big Grey Smoke
    "BM2":   "SMOKE",         # Black Smoke
    "BW1":   "SMOKE",         # Black & White smoke
    "DB1":   "DUST",          # Dust/Debris
    "FB1":   "FIRE",          # Fire Ball
    "FE1":   "FIRE",          # Fire Element
    "FSP":   "SPARKS",        # Fire Sparks
    "GE":    "EXPLOSIONS",    # Ground Explosion
    "GSM2":  "SMOKE",         # Ground Smoke
    "MF2":   "MUZZLE_FLASH",  # Muzzle Flash
    "SF1":   "SPARKS",        # Sparks/Fire
    "WF":    "WATER",         # Water/Fire
    "F-BL1": "EXPLOSIONS",    # Fire Blast Large
    "F-BM1": "FIRE",          # Fire Big Medium
    "F-BS":  "SPARKS",        # Falling Brass Shells
    "F-BTR": "FIRE",          # Fire BTR
    "F-DW1": "DUST",          # Dust Wave
    "F-L1":  "FIRE",          # Fire Large
    "F-LD1": "LENS_FX",       # Lens Dirt
    "F-SH1": "SMOKE",         # Smoke Heavy
    "F-SP1": "SPARKS",        # Sparks
    "DustWave": "DUST",
    "Electric": "LIGHTNING",
    "Sparks":   "SPARKS",
    "Single_Muzzle": "MUZZLE_FLASH",
    "Free_Blood": "BLOOD",
    "Gore_Textures": "GORE",
}

# VideoCopilot AE2K subfolder number → category
VC_FOLDERS = {
    "01": "ATMOSPHERICS",
    "02": "BLOOD",
    "03": "EXPLOSIONS",
    "04": "IMPACTS",
    "05": "DUST",
    "06": "DUST",
    "07": "DUST",
    "08": "EXPLOSIONS",
    "09": "FIRE",
    "10": "IMPACTS",
    "11": "MUZZLE_FLASH",
    "12": "IMPACTS",
    "13": "DUST",
    "14": "SMOKE",
    "15": "SMOKE",
    "16": "SPARKS",
    "17": "IMPACTS",
    "18": "SPARKS",
    "19": "WATER",
    "20": "TEXTURES",
}


def auto_categorize(rel_path: str) -> tuple[str, str]:
    """Return (CATEGORY, subcategory_hint) from a relative path string."""
    p = rel_path.lower().replace("\\", "/")

    # ActionVFX code check first (folder names like "BF1_2K-PRORES")
    for code, cat in ACTIONVFX_CODES.items():
        if f"/{code.lower()}" in p or p.startswith(code.lower()):
            return cat, ""

    # VideoCopilot numbered subfolder
    m = re.search(r"action_essentials_2k[/\\](\d{2})", rel_path, re.IGNORECASE)
    if m:
        num = m.group(1)
        return VC_FOLDERS.get(num, "MISC"), ""

    # Sky Library
    if "sky library" in p or "mattepaint" in p:
        return "SKY", ""

    # Keyword scan
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in p:
                return cat, ""

    return "MISC", ""


# ── DATA MODEL ───────────────────────────────────────────────────────────────

@dataclass
class Element:
    """Represents one VFX element (video, image sequence, or still)."""
    source_type: str          # "video" | "image_sequence" | "image"
    source_path: str          # absolute path to video file OR first frame of sequence
    source_folder: str        # top-level source folder name
    rel_path: str             # path relative to LIBRARY_ROOT
    name: str                 # display name (derived from filename/folder)
    extension: str            # lowercase extension of source
    # Set during ingestion
    element_id: str = ""
    category: str = "MISC"
    subcategory: str = ""
    thumbnail_path: str = ""
    proxy_path: str = ""
    has_alpha: bool = False
    resolution: list = field(default_factory=list)
    fps: float = 0.0
    duration_sec: float = 0.0
    frame_count: int = 0
    codec: str = ""
    pix_fmt: str = ""
    colorspace: str = ""
    file_size_bytes: int = 0
    seq_frame_range: list = field(default_factory=list)
    seq_first_frame: str = ""
    tags: list = field(default_factory=list)
    date_ingested: str = ""
    ingest_status: str = "pending"
    ingest_error: str = ""


# ── ELEMENT DISCOVERY ────────────────────────────────────────────────────────

FRAME_RE = re.compile(r'^(.*?)[\._]?(\d{2,8})$')


def _group_sequences(files: list[tuple[str, Path]]) -> tuple[list[Element], list[Element]]:
    """Split a dir's image files into sequences and singletons."""
    groups = defaultdict(list)
    singletons = []

    for fname, fpath in files:
        stem = fpath.stem
        ext  = fpath.suffix.lower()
        m = FRAME_RE.match(stem)
        if m:
            base, num = m.group(1), m.group(2)
            # Frame numbers > 9999 are stock IDs / timestamps, not sequence frames
            if len(num) <= 6 and base.strip():
                groups[(base, ext)].append((int(num), fname, fpath))
                continue
        singletons.append((fname, fpath))

    sequences = []
    for (base, ext), frames in groups.items():
        if len(frames) < 3:
            for _, fname, fpath in frames:
                singletons.append((fname, fpath))
            continue
        frames.sort(key=lambda x: x[0])
        first_frame_path = frames[0][2]
        rel = str(first_frame_path.relative_to(LIBRARY_ROOT))
        src_folder = rel.split(os.sep)[0] if os.sep in rel else rel
        name = base.strip("._- ") or fpath.stem
        seq = Element(
            source_type   = "image_sequence",
            source_path   = str(first_frame_path),
            source_folder = src_folder,
            rel_path      = rel,
            name          = name,
            extension     = ext,
            seq_frame_range = [frames[0][0], frames[-1][0]],
            seq_first_frame = str(first_frame_path),
            file_size_bytes = sum(f[2].stat().st_size for f in frames if f[2].exists()),
        )
        sequences.append(seq)

    singleton_elements = []
    for fname, fpath in singletons:
        ext = fpath.suffix.lower()
        rel = str(fpath.relative_to(LIBRARY_ROOT))
        src_folder = rel.split(os.sep)[0] if os.sep in rel else rel
        is_video = ext in VIDEO_EXTS
        e = Element(
            source_type   = "video" if is_video else "image",
            source_path   = str(fpath),
            source_folder = src_folder,
            rel_path      = rel,
            name          = fpath.stem,
            extension     = ext,
            file_size_bytes = fpath.stat().st_size if fpath.exists() else 0,
        )
        singleton_elements.append(e)

    return sequences, singleton_elements


def find_elements() -> list[Element]:
    """Walk all source folders and return a list of Element objects."""
    all_elements = []

    for folder_name in SOURCE_FOLDERS:
        folder = LIBRARY_ROOT / folder_name
        if not folder.exists():
            logging.warning(f"Source folder not found, skipping: {folder}")
            continue

        for dirpath, dirnames, filenames in os.walk(folder):
            # Prune skip dirs in-place
            dirnames[:] = [d for d in dirnames
                           if d not in SKIP_DIRS and not d.startswith(SKIP_PREFIX)]

            dp = Path(dirpath)
            img_files = []
            vid_files = []

            for fname in filenames:
                if fname.startswith(SKIP_PREFIX):
                    continue
                fpath = dp / fname
                ext = fpath.suffix.lower()
                if ext in VIDEO_EXTS:
                    vid_files.append((fname, fpath))
                elif ext in IMAGE_EXTS:
                    img_files.append((fname, fpath))

            # Process image files — group into sequences
            if img_files:
                seqs, singles = _group_sequences(img_files)
                all_elements.extend(seqs)
                all_elements.extend(singles)

            # Process video files — always singletons
            for fname, fpath in vid_files:
                ext = fpath.suffix.lower()
                rel = str(fpath.relative_to(LIBRARY_ROOT))
                src_folder = rel.split(os.sep)[0] if os.sep in rel else folder_name
                e = Element(
                    source_type   = "video",
                    source_path   = str(fpath),
                    source_folder = src_folder,
                    rel_path      = rel,
                    name          = fpath.stem,
                    extension     = ext,
                    file_size_bytes = fpath.stat().st_size if fpath.exists() else 0,
                )
                all_elements.append(e)

    # Assign IDs and categories
    for e in all_elements:
        e.element_id   = hashlib.md5(e.rel_path.encode()).hexdigest()[:12]
        e.category, e.subcategory = auto_categorize(e.rel_path)
        e.date_ingested = datetime.now().strftime("%Y-%m-%d")

    logging.info(f"Discovered {len(all_elements)} elements across {len(SOURCE_FOLDERS)} folders")
    return all_elements


# ── FFPROBE ──────────────────────────────────────────────────────────────────

def probe(path: str) -> dict:
    """Run ffprobe on a file and return parsed JSON. Returns {} on failure."""
    try:
        cmd = [
            FFPROBE, "-v", "quiet",
            "-print_format", "json",
            "-show_streams", "-show_format",
            path
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            return {}
        return json.loads(r.stdout)
    except Exception as e:
        logging.warning(f"ffprobe failed on {path}: {e}")
        return {}


def enrich_from_probe(e: Element, data: dict):
    """Fill Element fields from ffprobe output in-place."""
    fmt = data.get("format", {})
    try:
        e.duration_sec = round(float(fmt.get("duration", 0)), 3)
    except (ValueError, TypeError):
        pass

    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            e.resolution = [stream.get("width", 0), stream.get("height", 0)]
            e.codec      = stream.get("codec_name", "")
            e.pix_fmt    = stream.get("pix_fmt", "")
            e.colorspace = stream.get("color_space", "") or stream.get("color_transfer", "")

            # Frame count
            nb = stream.get("nb_frames")
            if nb and nb != "N/A":
                try:
                    e.frame_count = int(nb)
                except ValueError:
                    pass
            if not e.frame_count and e.duration_sec:
                rfr = stream.get("r_frame_rate", "0/1")
                try:
                    n, d = rfr.split("/")
                    fps = int(n) / int(d)
                    e.fps = round(fps, 3)
                    e.frame_count = int(e.duration_sec * fps)
                except (ValueError, ZeroDivisionError):
                    pass

            # FPS if not set
            if not e.fps:
                rfr = stream.get("r_frame_rate", "0/1")
                try:
                    n, d = rfr.split("/")
                    e.fps = round(int(n) / int(d), 3)
                except (ValueError, ZeroDivisionError):
                    pass

            # Alpha detection
            alpha_fmts = {"yuva420p", "yuva422p", "yuva444p", "rgba", "argb",
                          "bgra", "abgr", "rgba64le", "rgba64be",
                          "gbrpa", "gbrapf32le", "gbrapf32be"}
            alpha_codecs = {"prores_ks", "prores", "png", "targa", "qtrle",
                            "hap_alpha", "hap_q_alpha"}
            if (e.pix_fmt in alpha_fmts or e.codec in alpha_codecs):
                e.has_alpha = True
            # ProRes 4444 profile check
            profile = stream.get("profile", "")
            if "4444" in profile or "4444xq" in profile.lower():
                e.has_alpha = True

            break


# ── FFMPEG HELPERS ────────────────────────────────────────────────────────────

def _is_linear(e: Element) -> bool:
    """True if the source is likely linear light (EXR, HDR, DPX log, CIN)."""
    return e.extension in {".exr", ".hdr", ".cin", ".dpx"}


def _tonemap_filter(e: Element, width: int) -> str:
    """Return appropriate vf filter string for the given element."""
    scale = f"scale={width}:-2:flags=lanczos"
    if _is_linear(e):
        # linear → SDR via zscale + tonemap
        return (
            f"zscale=t=linear:npl=100:primaries=bt709:m=bt709,"
            f"tonemap=hable:desat=0,"
            f"zscale=t=bt709:m=bt709:p=bt709:r=limited,"
            f"{scale},"
            f"format=yuv420p"
        )
    return f"{scale},format=yuv420p"


def _fallback_filter(width: int) -> str:
    """Plain scale with no colorspace conversion — used when zscale fails."""
    return f"scale={width}:-2:flags=lanczos,format=yuv420p"


def _seq_pattern(first_frame: str, frame_range: list) -> tuple[str, int]:
    """
    Given first frame path, return (ffmpeg_pattern, start_number).
    Handles both underscore and dot separators and varying pad widths.
    """
    p = Path(first_frame)
    stem = p.stem
    m = FRAME_RE.match(stem)
    if not m:
        return str(first_frame), frame_range[0] if frame_range else 0
    base, num_str = m.group(1), m.group(2)
    pad = len(num_str)
    sep = stem[len(base)] if len(stem) > len(base) else "."
    # Use the separator that was actually in the filename
    pattern = str(p.parent / f"{base}{sep}%0{pad}d{p.suffix}")
    return pattern, int(num_str)


def generate_thumbnail(e: Element, out_path: Path, rebuild: bool = False) -> bool:
    """Generate a JPEG thumbnail. Returns True on success."""
    if out_path.exists() and not rebuild:
        return True
    out_path.parent.mkdir(parents=True, exist_ok=True)

    vf = _tonemap_filter(e, THUMB_WIDTH)

    try:
        if e.source_type == "video":
            # Seek to ~15% through clip for a representative frame
            seek = max(0.5, e.duration_sec * 0.15) if e.duration_sec > 1 else 0
            cmd = [
                FFMPEG, "-y", "-loglevel", "error",
                "-ss", str(seek),
                "-i", e.source_path,
                "-vframes", "1",
                "-vf", vf,
                "-q:v", "3",
                str(out_path)
            ]

        elif e.source_type == "image_sequence":
            pattern, start = _seq_pattern(e.seq_first_frame, e.seq_frame_range)
            total = (e.seq_frame_range[1] - e.seq_frame_range[0] + 1
                     if e.seq_frame_range else 1)
            pick  = start + max(0, int(total * 0.15))
            seek_frames = pick - start
            cmd = [
                FFMPEG, "-y", "-loglevel", "error",
                "-start_number", str(start),
                "-i", pattern,
                "-vf", f"select=eq(n\\,{seek_frames}),{vf}",
                "-vframes", "1",
                str(out_path)
            ]

        else:  # single image
            cmd = [
                FFMPEG, "-y", "-loglevel", "error",
                "-i", e.source_path,
                "-vf", vf,
                "-vframes", "1",
                str(out_path)
            ]

        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if r.returncode != 0 or not out_path.exists():
            # Fallback: retry with plain scale (no colorspace conversion)
            if _is_linear(e):
                cmd_fb = [c if c != vf else _fallback_filter(THUMB_WIDTH) for c in cmd]
                r2 = subprocess.run(cmd_fb, capture_output=True, text=True, timeout=60)
                if r2.returncode == 0 and out_path.exists():
                    logging.warning(f"Thumbnail used fallback filter [{e.name}]")
                    return True
            logging.warning(f"Thumbnail failed [{e.name}]: {r.stderr.strip()[:200]}")
            return False
        return True

    except subprocess.TimeoutExpired:
        logging.warning(f"Thumbnail timeout: {e.source_path}")
        return False
    except Exception as ex:
        logging.warning(f"Thumbnail error [{e.name}]: {ex}")
        return False


def generate_proxy(e: Element, out_path: Path, rebuild: bool = False) -> bool:
    """Generate a compact H.264 proxy MP4. Returns True on success."""
    # Single still images with no alpha don't need a proxy
    if e.source_type == "image" and e.extension not in DYNAMIC_IMG_EXTS:
        return True

    if out_path.exists() and not rebuild:
        return True
    out_path.parent.mkdir(parents=True, exist_ok=True)

    vf = _tonemap_filter(e, PROXY_WIDTH)
    encode = ["-c:v", "libx264", "-crf", "23", "-preset", "fast",
              "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart"]

    try:
        if e.source_type == "video":
            dur = ["-t", str(PROXY_MAX_DUR)] if e.duration_sec > PROXY_MAX_DUR else []
            cmd = ([FFMPEG, "-y", "-loglevel", "error",
                    "-i", e.source_path]
                   + dur
                   + ["-vf", vf]
                   + encode
                   + [str(out_path)])

        elif e.source_type == "image_sequence":
            pattern, start = _seq_pattern(e.seq_first_frame, e.seq_frame_range)
            total_frames = (e.seq_frame_range[1] - e.seq_frame_range[0] + 1
                            if e.seq_frame_range else 1)
            max_frames = PROXY_MAX_DUR * PROXY_FPS
            frames_arg = (["-frames:v", str(int(max_frames))]
                          if total_frames > max_frames else [])
            cmd = ([FFMPEG, "-y", "-loglevel", "error",
                    "-r", str(PROXY_FPS),
                    "-start_number", str(start),
                    "-i", pattern]
                   + frames_arg
                   + ["-vf", vf, "-r", str(PROXY_FPS)]
                   + encode
                   + [str(out_path)])

        else:  # single image (HDR/EXR) → still frame proxy
            cmd = ([FFMPEG, "-y", "-loglevel", "error",
                    "-loop", "1", "-i", e.source_path,
                    "-t", "1"]
                   + ["-vf", vf]
                   + encode
                   + [str(out_path)])

        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if r.returncode != 0 or not out_path.exists():
            # Fallback: retry with plain scale (no colorspace conversion)
            if _is_linear(e):
                fb = _fallback_filter(PROXY_WIDTH)
                cmd_fb = [fb if c == vf else c for c in cmd]
                r2 = subprocess.run(cmd_fb, capture_output=True, text=True, timeout=300)
                if r2.returncode == 0 and out_path.exists():
                    logging.warning(f"Proxy used fallback filter [{e.name}]")
                    return True
            logging.warning(f"Proxy failed [{e.name}]: {r.stderr.strip()[:200]}")
            return False
        return True

    except subprocess.TimeoutExpired:
        logging.warning(f"Proxy timeout: {e.source_path}")
        return False
    except Exception as ex:
        logging.warning(f"Proxy error [{e.name}]: {ex}")
        return False


# ── PER-ELEMENT INGEST ────────────────────────────────────────────────────────

def ingest_element(e: Element, rebuild: bool = False) -> Element:
    """Process one element: probe → thumbnail → proxy → write JSON."""
    # Derive output paths (mirror source structure under output dirs)
    rel_stem = Path(e.rel_path).with_suffix("")
    thumb_path = THUMB_DIR  / (str(rel_stem) + "_thumb.jpg")
    proxy_path = PROXY_DIR  / (str(rel_stem) + "_proxy.mp4")
    meta_path  = META_DIR   / (str(rel_stem) + ".json")

    # Skip if fully processed
    if (not rebuild
            and meta_path.exists()
            and thumb_path.exists()
            and (proxy_path.exists() or e.source_type == "image")):
        # Load existing and return
        try:
            with open(meta_path, encoding="utf-8") as f:
                data = json.load(f)
            # Re-hydrate element from saved metadata
            for k, v in data.items():
                if hasattr(e, k):
                    setattr(e, k, v)
            e.ingest_status = "cached"
            return e
        except Exception:
            pass  # fall through to re-process

    # ── Probe ──
    probe_input = e.source_path
    data = probe(probe_input)
    if data:
        enrich_from_probe(e, data)

    # For image sequences: probe fills resolution/codec but not fps/frame_count
    if e.source_type == "image_sequence" and e.seq_frame_range:
        e.frame_count = e.seq_frame_range[1] - e.seq_frame_range[0] + 1
        if not e.fps:
            e.fps = float(PROXY_FPS)
        e.duration_sec = round(e.frame_count / e.fps, 3) if e.fps else 0

    # ── Thumbnail ──
    thumb_ok = generate_thumbnail(e, thumb_path, rebuild)
    if thumb_ok:
        e.thumbnail_path = str(thumb_path)

    # ── Proxy ──
    proxy_ok = generate_proxy(e, proxy_path, rebuild)
    if proxy_ok and proxy_path.exists():
        e.proxy_path = str(proxy_path)

    # ── Write JSON sidecar ──
    e.ingest_status = "ok" if (thumb_ok and proxy_ok) else "partial"
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(asdict(e), f, indent=2, ensure_ascii=False)
    except Exception as ex:
        logging.error(f"JSON write failed [{e.name}]: {ex}")
        e.ingest_error = str(ex)

    return e


# ── INDEX ─────────────────────────────────────────────────────────────────────

def build_index():
    """Scan all JSON sidecars and write a flat master index.json."""
    records = []
    for json_file in META_DIR.rglob("*.json"):
        try:
            with open(json_file, encoding="utf-8") as f:
                records.append(json.load(f))
        except Exception as ex:
            logging.warning(f"Skipping bad JSON {json_file}: {ex}")

    records.sort(key=lambda x: (x.get("category", ""), x.get("name", "")))
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump({"generated": datetime.now().isoformat(),
                   "count": len(records),
                   "elements": records}, f, indent=2, ensure_ascii=False)
    print(f"\nIndex written: {INDEX_PATH}  ({len(records):,} elements)")
    return records


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="VFX Element Library Ingestion")
    parser.add_argument("--dry-run",      action="store_true",
                        help="Discover elements only, no FFmpeg output")
    parser.add_argument("--rebuild-all",  action="store_true",
                        help="Re-generate thumbnails/proxies even if they exist")
    parser.add_argument("--index-only",   action="store_true",
                        help="Rebuild index.json from existing metadata, no FFmpeg")
    parser.add_argument("--workers",      type=int, default=DEFAULT_WORKERS,
                        help=f"Parallel FFmpeg jobs (default {DEFAULT_WORKERS})")
    parser.add_argument("--category",     type=str, default=None,
                        help="Only process elements matching this category (e.g. FIRE)")
    args = parser.parse_args()

    # Logging
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%H:%M:%S",
        handlers=[
            logging.FileHandler(LOG_PATH, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ]
    )

    logging.info("=" * 60)
    logging.info("VFX ELEMENT LIBRARY INGESTION")
    logging.info(f"Library root : {LIBRARY_ROOT}")
    logging.info(f"Output root  : {OUTPUT_ROOT}")
    logging.info(f"Workers      : {args.workers}")
    logging.info(f"Rebuild all  : {args.rebuild_all}")
    logging.info("=" * 60)

    # Index-only mode
    if args.index_only:
        build_index()
        return

    # Discover elements
    elements = find_elements()

    # Optional category filter
    if args.category:
        elements = [e for e in elements
                    if e.category.upper() == args.category.upper()]
        logging.info(f"Category filter '{args.category}': {len(elements)} elements")

    if args.dry_run:
        # Print category breakdown and exit
        from collections import Counter
        cats = Counter(e.category for e in elements)
        types = Counter(e.source_type for e in elements)
        print(f"\n{'-'*50}")
        print(f"DRY RUN -- {len(elements):,} elements found\n")
        print("By category:")
        for cat, n in sorted(cats.items(), key=lambda x: -x[1]):
            print(f"  {cat:<20} {n:>5,}")
        print("\nBy type:")
        for t, n in sorted(types.items(), key=lambda x: -x[1]):
            print(f"  {t:<20} {n:>5,}")
        print(f"{'-'*50}\n")
        return

    # Process elements in parallel
    total = len(elements)
    done = 0
    errors = 0
    skipped = 0

    print(f"\nProcessing {total:,} elements with {args.workers} workers...\n")

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(ingest_element, e, args.rebuild_all): e
            for e in elements
        }
        for future in as_completed(futures):
            done += 1
            try:
                result = future.result()
                if result.ingest_status == "cached":
                    skipped += 1
                elif result.ingest_status != "ok":
                    errors += 1
            except Exception as ex:
                errors += 1
                src = futures[future].source_path
                logging.error(f"Unhandled error [{src}]: {ex}")

            # Progress line
            pct = done / total * 100
            bar_w = 30
            filled = int(bar_w * done / total)
            bar = "#" * filled + "-" * (bar_w - filled)
            print(f"\r  [{bar}] {pct:5.1f}%  {done:,}/{total:,}  "
                  f"errors:{errors}  cached:{skipped}",
                  end="", flush=True)

    print(f"\n\n{'-'*50}")
    print(f"Ingestion complete.")
    print(f"  Total    : {total:,}")
    print(f"  OK       : {total - errors - skipped:,}")
    print(f"  Cached   : {skipped:,}")
    print(f"  Errors   : {errors:,}")
    print(f"  Log      : {LOG_PATH}")
    print(f"{'-'*50}\n")

    build_index()


if __name__ == "__main__":
    main()
