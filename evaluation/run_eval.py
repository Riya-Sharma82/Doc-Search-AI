"""
DocSearch AI — Retrieval & Answer Evaluation Script

Measures:
  - Recall@K        : fraction of relevant docs appearing in top-K results
  - Precision@K     : fraction of top-K results that are relevant
  - MRR             : Mean Reciprocal Rank (first relevant result)
  - Answer fidelity : keyword overlap between expected and actual answer
  - Latency         : per-query and average end-to-end response time

Compares three retrieval modes:
  semantic-only (α=1), BM25-only (α=0), hybrid (α=0.5)

Usage:
    # Make sure the backend is running:
    #   uvicorn app.main:app --port 8000 --reload
    #
    # Upload sample docs first, then:
    python evaluation/run_eval.py \\
        --dataset evaluation/eval_dataset.json \\
        --api-url http://localhost:8000 \\
        --top-k 5

    # Custom alpha:
    python evaluation/run_eval.py --alpha 0.3 --top-k 10
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:
    print("requests is not installed. Run: pip install requests")
    sys.exit(1)


# ── Metrics ───────────────────────────────────────────────────────────────────

def recall_at_k(relevant: List[str], retrieved_filenames: List[str], k: int) -> float:
    """Fraction of relevant docs found in top-k results."""
    if not relevant:
        return 1.0   # no relevant docs expected → vacuously perfect
    top_k = retrieved_filenames[:k]
    hits = sum(1 for r in relevant if any(r in fn for fn in top_k))
    return hits / len(relevant)


def precision_at_k(relevant: List[str], retrieved_filenames: List[str], k: int) -> float:
    """Fraction of top-k results that are relevant."""
    if not retrieved_filenames:
        return 0.0
    top_k = retrieved_filenames[:k]
    hits = sum(1 for fn in top_k if any(r in fn for r in relevant))
    return hits / min(k, len(top_k))


def reciprocal_rank(relevant: List[str], retrieved_filenames: List[str]) -> float:
    """1 / rank of the first relevant result; 0 if none found."""
    for rank, fn in enumerate(retrieved_filenames, start=1):
        if any(r in fn for r in relevant):
            return 1.0 / rank
    return 0.0


def answer_fidelity(expected_keywords: List[str], actual_answer: str) -> float:
    """Fraction of expected keyword fragments found in the answer (case-insensitive)."""
    if not expected_keywords:
        return 1.0
    lower = actual_answer.lower()
    hits = sum(1 for kw in expected_keywords if kw.lower() in lower)
    return hits / len(expected_keywords)


# ── API calls ─────────────────────────────────────────────────────────────────

def call_search(
    api_url: str,
    query: str,
    top_k: int,
    alpha: float,
    timeout: int = 120,
) -> Optional[Dict[str, Any]]:
    try:
        resp = requests.post(
            f"{api_url}/api/search",
            json={"query": query, "top_k": top_k, "hybrid_alpha": alpha},
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"  [ERROR] API call failed: {exc}")
        return None


# ── Evaluation runner ─────────────────────────────────────────────────────────

def run_eval(
    dataset: List[Dict],
    api_url: str,
    top_k: int,
    alpha: float,
    mode_label: str,
) -> Dict[str, Any]:
    recalls, precisions, mrrs, fidelities, latencies = [], [], [], [], []
    results = []

    print(f"\n{'─'*60}")
    print(f"Mode: {mode_label}  (α={alpha}, top_k={top_k})")
    print(f"{'─'*60}")

    for item in dataset:
        q_id   = item["id"]
        query  = item["query"]
        rel    = item.get("relevant_docs", [])
        kws    = item.get("expected_answer_contains", [])
        no_ans = item.get("expects_no_answer", False)

        t0 = time.perf_counter()
        response = call_search(api_url, query, top_k, alpha)
        latency_ms = (time.perf_counter() - t0) * 1000

        if response is None:
            print(f"  [{q_id}] SKIP (API error)")
            continue

        retrieved_fns = [c["filename"] for c in response.get("retrieved_passages", [])]
        answer        = response.get("answer", "")

        rec  = recall_at_k(rel, retrieved_fns, top_k)
        prec = precision_at_k(rel, retrieved_fns, top_k)
        mrr  = reciprocal_rank(rel, retrieved_fns)
        fid  = answer_fidelity(kws, answer)

        recalls.append(rec)
        precisions.append(prec)
        mrrs.append(mrr)
        fidelities.append(fid)
        latencies.append(latency_ms)

        status = "✓" if fid >= 0.5 else "✗"
        print(
            f"  [{q_id}] {status} "
            f"R@{top_k}={rec:.2f}  P@{top_k}={prec:.2f}  "
            f"MRR={mrr:.2f}  Fid={fid:.2f}  "
            f"{latency_ms:.0f}ms"
        )
        if no_ans:
            sentinel_hit = "couldn't find" in answer.lower() or "insufficient" in answer.lower()
            print(f"       Hallucination guard: {'PASS ✓' if sentinel_hit else 'FAIL ✗'}")

        results.append({
            "id": q_id, "query": query,
            "recall": rec, "precision": prec, "mrr": mrr,
            "fidelity": fid, "latency_ms": latency_ms,
            "answer_snippet": answer[:120],
        })

    n = len(recalls) or 1
    summary = {
        "mode": mode_label,
        "alpha": alpha,
        "top_k": top_k,
        "recall_at_k":    sum(recalls)    / n,
        "precision_at_k": sum(precisions) / n,
        "mrr":            sum(mrrs)       / n,
        "fidelity":       sum(fidelities) / n,
        "avg_latency_ms": sum(latencies)  / n,
        "p95_latency_ms": sorted(latencies)[int(0.95 * len(latencies))] if latencies else 0,
        "per_query": results,
    }
    return summary


# ── Comparison table ──────────────────────────────────────────────────────────

def print_comparison(summaries: List[Dict]) -> None:
    print(f"\n{'═'*70}")
    print("COMPARISON SUMMARY")
    print(f"{'═'*70}")
    header = f"{'Mode':<20} {'R@K':>6} {'P@K':>6} {'MRR':>6} {'Fid':>6} {'AvgMs':>8} {'P95Ms':>8}"
    print(header)
    print("─" * 70)
    for s in summaries:
        print(
            f"{s['mode']:<20} "
            f"{s['recall_at_k']:>6.3f} "
            f"{s['precision_at_k']:>6.3f} "
            f"{s['mrr']:>6.3f} "
            f"{s['fidelity']:>6.3f} "
            f"{s['avg_latency_ms']:>8.0f} "
            f"{s['p95_latency_ms']:>8.0f}"
        )
    print(f"{'═'*70}\n")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="DocSearch AI evaluation")
    parser.add_argument("--dataset",  default="evaluation/eval_dataset.json")
    parser.add_argument("--api-url",  default="http://localhost:8000")
    parser.add_argument("--top-k",    type=int,   default=5)
    parser.add_argument("--alpha",    type=float, default=None,
                        help="Run a single alpha; omit to compare all three modes")
    parser.add_argument("--output",   default=None,
                        help="Optional JSON file to write full results")
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        print(f"Dataset not found: {dataset_path}")
        sys.exit(1)

    dataset = json.loads(dataset_path.read_text())
    print(f"Loaded {len(dataset)} evaluation examples from {dataset_path}")
    print(f"API endpoint: {args.api_url}")

    # Check server is up
    try:
        health = requests.get(f"{args.api_url}/api/health", timeout=10).json()
        print(f"Backend: {health.get('status')} — {health.get('documents_indexed')} docs indexed")
        if health.get("documents_indexed", 0) == 0:
            print("\n⚠  No documents are indexed. Upload sample_docs/ first, then re-run.\n")
    except Exception as exc:
        print(f"Cannot reach backend at {args.api_url}: {exc}")
        sys.exit(1)

    if args.alpha is not None:
        modes = [(args.alpha, f"custom α={args.alpha}")]
    else:
        modes = [
            (0.0, "BM25-only   (α=0.0)"),
            (1.0, "Semantic    (α=1.0)"),
            (0.5, "Hybrid      (α=0.5)"),
        ]

    summaries = []
    for alpha, label in modes:
        summary = run_eval(dataset, args.api_url, args.top_k, alpha, label)
        summaries.append(summary)

    print_comparison(summaries)

    if args.output:
        Path(args.output).write_text(json.dumps(summaries, indent=2))
        print(f"Full results written to {args.output}")


if __name__ == "__main__":
    main()
