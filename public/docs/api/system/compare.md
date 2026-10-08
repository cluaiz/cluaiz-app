# Autonomous Model Execution Planning Engine API

`POST /v1/system/plan`

Performs deterministic, physics-based evaluation of the 5 execution candidates against live probed hardware and extracts real model capabilities directly from registry metadata and binary headers:

* **Candidate A (Full GPU):** All layers and KV cache fit resident in VRAM. 0 PCIe transfer during token generation.
* **Candidate B (Weights GPU, KV RAM):** All weights in VRAM, KV cache in Host RAM (`offload_kqv=false`). Attention executes on CPU with per-layer ping-pong round-trips.
* **Candidate C (Split Hybrid):** Highest layers offloaded to GPU ($g$ layers), remaining layers executed directly on CPU in RAM. 1 PCIe activation boundary transfer.
* **Candidate D (CPU Only):** Entire model and KV cache reside in Host RAM, computed via multi-threaded AVX2 SIMD.
* **Candidate E (MoE Split):** Attention/shared layers in VRAM, routed sparse experts resolved from Host RAM.

---

## 📌 Endpoint Information

* **HTTP Method:** `POST`
* **Path:** `/v1/system/plan`
* **Authentication:** Optional for local development; Bearer token required in secured mode.
* **Content-Type:** `application/json`
* **Response Format:** `application/json`

---

## 🧠 Dynamic Capabilities & Candidate Arbitration

LLM token generation ($N = 1$) is strictly **memory bandwidth bound**.

1. **Autonomous Geometry & Probing:**
   When a model identifier or path is provided, the engine queries `model_registry.json` and scans `.gguf` binary headers directly via zero-copy probers to extract actual layer counts, context windows, KV dimensions, and parameter sizes without static heuristics.

2. **Multimodal & Modality Capabilities:**
   Automatically derives `supported_inputs`, `supported_outputs`, and `supported_attachments` based on the sovereign slot (`Chat`, `Ingest`, `Embedding`, `Tts`, `Stt`):
   * **Chat LLM:** Inputs `["text"]`, Outputs `["text"]`, Attachments `["pdf", "txt", "code", "markdown", "csv", "json"]`
   * **Vision / Ingest:** Inputs `["text", "image"]`, Outputs `["text"]`, Attachments `["image", "pdf", "video", "txt"]`
   * **Speech-to-Text (STT):** Inputs `["audio"]`, Outputs `["text"]`, Attachments `["audio", "wav", "mp3", "m4a", "flac"]`
   * **Text-to-Speech (TTS):** Inputs `["text"]`, Outputs `["audio"]`, Attachments `["txt"]`
   * **Embedding:** Inputs `["text"]`, Outputs `["embedding"]`, Attachments `["txt", "pdf", "code", "csv", "json"]`

---

## 📥 Request Body Schema

| Parameter | Type | Required | Default | Description |
|:---|:---|:---|:---|:---|
| `model` | `string` | Optional | Auto | Model identifier from installed registry (e.g. `bonsai-4b-gguf-q1_0`, `bonsai1-8b`). |
| `model_path` | `string` | Optional | `null` | Absolute path to model file for direct binary probing. |
| `batch_tokens` | `integer` (usize) | Optional | `1` | Evaluation batch size in tokens (1 for single-token generation; $\ge 64$ for prefill). |
| `weights_gb` | `number` (f64) | Optional | Auto | Model weights size in GB (auto-probed from file if omitted). |
| `total_layers` | `integer` (usize) | Optional | Auto | Transformer layer count (auto-probed from GGUF header if omitted). |
| `n_ctx` | `integer` (usize) | Optional | Auto | Context window size (auto-probed from header or registry). |
| `vram_buffer_gb`| `number` (f64) | Optional | `0.25-0.5` | VRAM buffer reserved for desktop & OS. |
| `ram_buffer_gb` | `number` (f64) | Optional | `5%` | RAM safety buffer. |

```json
{
  "model": "bonsai-4b-gguf-q1_0",
  "batch_tokens": 1
}
```

---

## 💻 Code Examples

### 1. cURL
```bash
curl -X POST http://localhost:8080/v1/system/plan \
  -H "Content-Type: application/json" \
  -d '{"model": "bonsai-4b-gguf-q1_0"}'
```

### 2. Python
```python
import requests

payload = {
    "model": "bonsai-4b-gguf-q1_0"
}

res = requests.post("http://localhost:8080/v1/system/plan", json=payload)
data = res.json()

if data.get("status") == "success":
    decision = data["decision"]
    print(f"Model: {decision['model_name']} ({decision['architecture']})")
    print(f"Winner: {decision['winner_candidate_id']}")
    print(f"TPS: {decision['winner_generation_tps']:.1f}")
    print(f"TTFT: {decision['winner_ttft_ms']:.1f} ms")
    print(f"Max Input Tokens: {decision['max_input_tokens']}")
    print(f"Supported Inputs: {decision['supported_inputs']}")
    print(f"Supported Attachments: {decision['supported_attachments']}")
```

---

## 📤 Response Schema

```json
{
  "status": "success",
  "decision": {
    "model_name": "bonsai-4b-gguf-q1_0",
    "architecture": "qwen3",
    "weights_gb": 0.53,
    "batch_tokens": 1,
    "total_layers": 36,
    "n_ctx": 32768,
    "max_input_tokens": 32768,
    "max_output_tokens": 4096,
    "supported_inputs": ["text"],
    "supported_outputs": ["text"],
    "supported_attachments": ["pdf", "txt", "code", "markdown", "csv", "json"],
    "supported_modalities": ["text"],
    "kv_cache_gb": 0.12,
    "compute_buffer_gb": 0.08,
    "vram_safety_buffer_gb": 0.25,
    "ram_safety_buffer_gb": 1.19,
    "vram_free_needed_gb": 0.95,
    "ram_free_needed_gb": 1.19,
    "gpu_layers": 36,
    "cpu_layers": 0,
    "model_fits_in_vram": true,
    "faster_target": "GPU_VRAM (Candidate A: Full GPU)",
    "speedup_ratio": 6.25,
    "cpu_latency_ms": 42.15,
    "gpu_vram_latency_ms": 6.74,
    "gpu_pcie_latency_ms": 115.20,
    "winner_candidate_id": "candidate_a_full_gpu",
    "winner_generation_tps": 148.4,
    "winner_ttft_ms": 14.2,
    "decision_reason": "Candidate A: Full GPU (VRAM-Resident) wins with 148.4 tokens/sec (6.25x faster than CPU 23.7 TPS, TTFT 14.2 ms).",
    "breakdown": "Model: 0.53 GB (36 layers, ctx: 32768) | Winner: Candidate A @ 148.4 TPS (TTFT: 14.2 ms, 6.25x vs CPU)",
    "candidates": [
      {
        "id": "candidate_a_full_gpu",
        "name": "Candidate A: Full GPU (VRAM-Resident)",
        "feasible": true,
        "gpu_layers": 36,
        "cpu_layers": 0,
        "vram_required_gb": 0.85,
        "generation_tps": 148.4,
        "ttft_ms": 14.2,
        "is_winner": true
      },
      {
        "id": "candidate_b_weights_gpu_kv_ram",
        "name": "Candidate B: Weights GPU, KV in Host RAM (offload_kqv=false)",
        "feasible": true,
        "generation_tps": 42.1,
        "ttft_ms": 24.5,
        "is_winner": false
      },
      {
        "id": "candidate_c_split_hybrid",
        "name": "Candidate C: Split Hybrid (Partial Offload)",
        "feasible": true,
        "generation_tps": 112.0,
        "ttft_ms": 19.3,
        "is_winner": false
      },
      {
        "id": "candidate_d_cpu_only",
        "name": "Candidate D: CPU Only (Host RAM SIMD)",
        "feasible": true,
        "generation_tps": 23.7,
        "ttft_ms": 42.2,
        "is_winner": false
      },
      {
        "id": "candidate_e_moe_split",
        "name": "Candidate E: MoE Split (Active Experts in RAM)",
        "feasible": false,
        "generation_tps": 0.0,
        "ttft_ms": 0.0,
        "is_winner": false
      }
    ]
  }
}
```
