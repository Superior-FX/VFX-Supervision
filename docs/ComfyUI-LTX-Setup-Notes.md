# ComfyUI LTX-2.3 Setup Notes

_Last updated: 2026-10-07_

## Summary

- **New LTX-2.3 models** are in `C:\Users\atomsmasher\Documents\ComfyUI\models`, and I checked that they're intact.
- **The ComfyUI running on port 8188** is the **"Superior Studios GenAI Workflows"** Comfy Desktop instance. It can see those models.
- **That instance doesn't have the `ComfyUI-LTXVideo` custom nodes installed**, so the LTX workflows won't run there until they're added.

---

## Models downloaded

Source: [Lightricks/LTX-2.3 on Hugging Face](https://huggingface.co/Lightricks/LTX-2.3)

| File | Folder (under `Documents\ComfyUI\models`) | Size |
|---|---|---|
| `ltx-2.3-temporal-upscaler-x2-1.0.safetensors` | `latent_upscale_models` | 0.24 GB |
| `ltx-2.3-spatial-upscaler-x1.5-1.0.safetensors` | `latent_upscale_models` | 1.02 GB |
| `ltx-2.3-22b-distilled-lora-384-1.1.safetensors` | `loras` | 7.08 GB |

The `.cache\huggingface` metadata folders that the download created have been deleted.

### Integrity check

SHA-256 of `ltx-2.3-22b-distilled-lora-384-1.1.safetensors`:

```
f5d4953f3386197a4b4f5abdb17616ff256171e8075c111d6e7d2dfa6e823b3a
```

✅ This matches the hash Hugging Face publishes for this file.

### LTX models already installed before this session

| File | Folder |
|---|---|
| `ltx-2.3-22b-dev-fp8.safetensors` | `checkpoints` |
| `ltx-video-2b-v0.9.1.safetensors` | `checkpoints` |
| `ltx-2.3-spatial-upscaler-x2-1.1.safetensors` | `latent_upscale_models` |
| `ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors` (community version) | `loras` |
| `gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors` | `loras` |
| `gemma_3_12B_it_fp4_mixed.safetensors` | `text_encoders` |
| `ltx-2.3_text_projection_bf16.safetensors` | `text_encoders` |

> **Tip:** In the example workflows, select the **official** `ltx-2.3-22b-distilled-lora-384-1.1` instead of the community rank-111 LoRA to match the repo's README.

### Not downloaded (optional)

- `ltx-2.3-22b-distilled-1.1.safetensors`: the distilled checkpoint, about 46 GB in bf16.
- Full Gemma text encoder `google/gemma-3-12b-it-qat-q4_0-unquantized`: about 24 GB. It's gated, so you have to accept Google's license on Hugging Face before downloading.
- IC-LoRAs and camera-control LoRAs. The full list is in the README for `ComfyUI-LTXVideo`.

---

## Which ComfyUI is on port 8188

| | |
|---|---|
| **Instance** | Comfy Desktop: "Superior Studios GenAI Workflows" |
| **Install path** | `C:\Users\atomsmasher\ComfyUI-Installs\Superior Studios GenAI Workflows\` |
| **Python** | `...\Superior Studios GenAI Workflows\ComfyUI\.venv\Scripts\python.exe` (3.13.12) |
| **ComfyUI** | 0.38.0 (frontend 1.53.6) |
| **PyTorch** | 2.12.1+cu130 |
| **GPU** | NVIDIA GeForce RTX 4090 (24 GB) |
| **Listening on** | `0.0.0.0:8188`, so other devices on the network can reach it |
| **Input / output** | `Documents\ComfyUI\input` / `Documents\ComfyUI\output` |
| **Model paths config** | `AppData\Roaming\Comfy Desktop\instance-model-paths\inst-1789338562769.yaml` |

### Model folders it reads

1. `C:\Users\atomsmasher\ComfyUI-Shared\models` (default; new downloads go here)
2. `C:\Users\atomsmasher\Documents\ComfyUI\models`, which has the new LTX files

### Custom nodes installed (from `/v2/customnode/installed`)

| Node pack | Repo | Commit |
|---|---|---|
| ComfyUI-LatentSyncWrapper | ShmuelRonen/ComfyUI-LatentSyncWrapper | `360d528` |
| ComfyUI-PuLID-Flux-Enhanced | sipie800/ComfyUI-PuLID-Flux-Enhanced | `edcb3af` |
| ComfyUI-VideoHelperSuite | Kosinkadink/ComfyUI-VideoHelperSuite | `4d907be` |
| ComfyUI-WanVideoWrapper | kijai/ComfyUI-WanVideoWrapper | `088128b` |
| ComfyUI_wav2lip | ShmuelRonen/ComfyUI_wav2lip | `4ed7fb1` |
| efficiency-nodes-comfyui | jags111/efficiency-nodes-comfyui | `4579b7d` |

All six are enabled.

---

## LTX install for remote use (2026-10-07)

Claude Code did this install on Will's machine, at Will's request, so Jon can run the LTX workflows remotely.

### Custom node: ComfyUI-LTXVideo

| | |
|---|---|
| **Repo** | https://github.com/Lightricks/ComfyUI-LTXVideo |
| **Commit** | `3bf3ca62595f1764c47d01c35c8e5dfe47e1a88f` (2026-10-01) |
| **Installed to** | `ComfyUI-Installs\Superior Studios GenAI Workflows\ComfyUI\custom_nodes\ComfyUI-LTXVideo` |
| **Packages added to the venv** | `colour-science 0.4.7`, `ninja 1.11.1.4`, `openimageio 3.1.18.1`. A dry run confirmed nothing existing was upgraded, including torch. |

### LoRA: IC-LoRA Alpha-Gen

| | |
|---|---|
| **Source** | Hugging Face `Lightricks/LTX-2.5-22b-IC-LoRA-Alpha-Gen` (gated; Will's HF account `WillSupFX`) |
| **File** | `ltx-2.5-22b-ic-lora-alpha-gen-0.9.safetensors` (1,308,787,472 bytes) |
| **Location** | `Documents\ComfyUI\models\loras\` |
| **SHA-256** | `d9e143f979e0756f0c83d772e6a8890f4c6b933db1f7d93fc06e25c179f3fd36` |

✅ The SHA-256 matches the hash Hugging Face publishes for this file. The `.cache\huggingface` folder the download created has been deleted.

### After the restart (2026-10-07 11:33)

The Manager's list (`/v2/customnode/installed`) now has 7 packs, all enabled. The new entry is:

| Node pack | Repo | Commit |
|---|---|---|
| ComfyUI-LTXVideo | Lightricks/ComfyUI-LTXVideo | `3bf3ca6` |

The other six are unchanged from the table above. The Alpha-Gen LoRA shows up in `/models/loras`.

### ⚠️ Blocker: Smart App Control

`ComfyUI-LTXVideo` and `ComfyUI-WanVideoWrapper` both show **IMPORT FAILED** when ComfyUI starts, with this error:

```
ImportError: DLL load failed while importing _openmp_helpers: An Application Control policy has blocked this file.
```

- **What's being blocked:** `.venv\Lib\site-packages\sklearn\utils\_openmp_helpers.cp313-win_amd64.pyd`. It's from scikit-learn 1.9.1, which was installed 2026-09-29, before this session. The file is unsigned.
- **What's blocking it:** Windows **Smart App Control**, which is on in enforce mode. The Code Integrity log records event IDs 3033 and 3077 at 11:33:10.
- **How it happens:** both packs import `transformers`, which imports scikit-learn, and Windows refuses to load that DLL. WanVideoWrapper was already broken by this before LTX was installed.
- **Status:** resolved on its own by 2026-10-09 (see below).

### ✅ Resolved (2026-10-09)

Nothing was changed. scikit-learn is still 1.9.1 and Smart App Control is still on.

- The same `.pyd` now loads under both the venv Python and `standalone-env\python.exe`. The Code Integrity log has no new block events for it. The likely cause is that Smart App Control's cloud reputation check changed its verdict on the file.
- ComfyUI restarted at 2026-10-09 11:15, and both packs imported cleanly:
  - `ComfyUI-LTXVideo`: 83 node classes registered, including `LTXVGemmaCLIPModelLoader`.
  - `ComfyUI-WanVideoWrapper`: 147 node classes registered.
- **If it happens again:** look for IMPORT FAILED in `ComfyUI\user\comfyui.log`. Try an older scikit-learn, such as 1.7.2, in the venv first. Turning off Smart App Control is the last resort.

## Next steps

1. Optionally download the full Gemma encoder or the other IC-LoRAs if a workflow needs them.
