import re
import json
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher, unified_diff
from typing import List, Dict, Any


# Weights for the single composite score
CONTENT_WEIGHT = 0.7
STRUCTURE_WEIGHT = 0.3


def clean_markdown(markdown: str) -> str:
    """Remove image links and normalize whitespace."""
    # Remove image links: ![alt](hash_img.jpg) or ![](hash_img.jpg)
    cleaned = re.sub(r'!\[.*?\]\([^)]*_img\.(?:jpg|jpeg|png)\)', '', markdown)
    # Remove empty lines left by removed images (more than 2 consecutive newlines)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    # Trim trailing whitespace from each line
    cleaned = '\n'.join(line.rstrip() for line in cleaned.splitlines())
    # Strip leading/trailing whitespace
    return cleaned.strip()


def compute_char_accuracy(ground_truth: str, ocr: str) -> float:
    """Character-level accuracy using SequenceMatcher."""
    return SequenceMatcher(None, ground_truth, ocr).ratio()


def normalize_text(text: str) -> str:
    """Reduce representational noise: Unicode NFC, drop punctuation/symbols, collapse whitespace."""
    text = unicodedata.normalize('NFC', text)
    # Remove markdown structural characters and punctuation/symbols, keep letters/digits/marks
    text = ''.join(c for c in text if not unicodedata.category(c).startswith(('P', 'S', 'Z', 'C')))
    return text


def compute_normalized_char_accuracy(ground_truth: str, ocr: str) -> float:
    """Char accuracy after normalizing away punctuation/whitespace/Unicode-form noise."""
    return SequenceMatcher(None, normalize_text(ground_truth), normalize_text(ocr)).ratio()


def compute_structure_score(gt_structure: Dict[str, int], ocr_structure: Dict[str, int]) -> float:
    """Mean per-type ratio of matching structure counts. 1.0 = perfectly matching shape."""
    ratios = []
    for key in ("headings", "tables", "list_items"):
        gt_count = gt_structure.get(key, 0)
        ocr_count = ocr_structure.get(key, 0)
        hi = max(gt_count, ocr_count)
        if hi == 0:
            ratios.append(1.0)  # both absent -> perfect match
        else:
            ratios.append(min(gt_count, ocr_count) / hi)
    return sum(ratios) / len(ratios)


def compute_word_f1(ground_truth: str, ocr: str) -> Dict[str, float]:
    """Word-level precision, recall, F1."""
    gt_words = ground_truth.split()
    ocr_words = ocr.split()

    if not gt_words and not ocr_words:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}
    if not gt_words or not ocr_words:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    gt_set = set(gt_words)
    ocr_set = set(ocr_words)

    intersection = gt_set & ocr_set
    precision = len(intersection) / len(ocr_set) if ocr_set else 0.0
    recall = len(intersection) / len(gt_set) if gt_set else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {"precision": precision, "recall": recall, "f1": f1}


def compute_line_diff(ground_truth: str, ocr: str) -> Dict[str, int]:
    """Count added/removed lines in unified diff."""
    gt_lines = ground_truth.splitlines(keepends=True)
    ocr_lines = ocr.splitlines(keepends=True)

    diff = list(unified_diff(gt_lines, ocr_lines, lineterm=''))
    added = sum(1 for line in diff if line.startswith('+') and not line.startswith('+++'))
    removed = sum(1 for line in diff if line.startswith('-') and not line.startswith('---'))

    return {"lines_added": added, "lines_removed": removed}


def count_structure_elements(markdown: str) -> Dict[str, int]:
    """Count headings, tables, lists."""
    lines = markdown.splitlines()
    headings = sum(1 for line in lines if line.startswith('#'))
    tables = sum(1 for line in lines if '|' in line and line.strip().startswith('|'))
    list_items = sum(1 for line in lines if re.match(r'^\s*[-*+]\s', line) or re.match(r'^\s*\d+\.\s', line))
    return {"headings": headings, "tables": tables, "list_items": list_items}


def main():
    # Paths (relative to v1/)
    raw_output_dir = Path("../output")
    ground_truth_dir = Path("../evaluation_files")
    clean_output_dir = Path("../output_clean")
    report_path = Path("../comparison_report.json")

    clean_output_dir.mkdir(exist_ok=True)

    # Find all .md files in raw output
    raw_files = sorted(raw_output_dir.glob("*.md"))
    print(f"Found {len(raw_files)} raw OCR files to process")

    per_file_results = []

    for raw_path in raw_files:
        stem = raw_path.stem
        gt_path = ground_truth_dir / f"{stem}.md"
        clean_path = clean_output_dir / f"{stem}.md"

        if not gt_path.exists():
            print(f"  ⚠ No ground truth for {stem}, skipping")
            continue

        try:
            # Read files
            raw_md = raw_path.read_text(encoding='utf-8')
            gt_md = gt_path.read_text(encoding='utf-8')

            # Clean OCR
            clean_md = clean_markdown(raw_md)
            clean_path.write_text(clean_md, encoding='utf-8')

            # Compute metrics
            char_acc = compute_char_accuracy(gt_md, clean_md)
            norm_char_acc = compute_normalized_char_accuracy(gt_md, clean_md)
            word_metrics = compute_word_f1(gt_md, clean_md)
            line_diff = compute_line_diff(gt_md, clean_md)
            gt_structure = count_structure_elements(gt_md)
            ocr_structure = count_structure_elements(clean_md)
            structure_score = compute_structure_score(gt_structure, ocr_structure)

            # Single composite: content matters more than layout
            composite = CONTENT_WEIGHT * word_metrics["f1"] + STRUCTURE_WEIGHT * structure_score

            result = {
                "file": stem,
                "char_accuracy": round(char_acc, 4),
                "normalized_char_accuracy": round(norm_char_acc, 4),
                "word_precision": round(word_metrics["precision"], 4),
                "word_recall": round(word_metrics["recall"], 4),
                "word_f1": round(word_metrics["f1"], 4),
                "structure_score": round(structure_score, 4),
                "composite_score": round(composite, 4),
                "lines_added": line_diff["lines_added"],
                "lines_removed": line_diff["lines_removed"],
                "gt_structure": gt_structure,
                "ocr_structure": ocr_structure,
            }
            per_file_results.append(result)

            print(f"  ✓ {stem}: word_f1={word_metrics['f1']:.3f}, struct={structure_score:.3f}, composite={composite:.3f}")

        except Exception as e:
            print(f"  ✗ Failed to process {stem}: {e}")

    # Aggregate metrics
    if per_file_results:
        n = len(per_file_results)
        agg = {
            "mean_char_accuracy": round(sum(r["char_accuracy"] for r in per_file_results) / n, 4),
            "mean_normalized_char_accuracy": round(sum(r["normalized_char_accuracy"] for r in per_file_results) / n, 4),
            "mean_word_precision": round(sum(r["word_precision"] for r in per_file_results) / n, 4),
            "mean_word_recall": round(sum(r["word_recall"] for r in per_file_results) / n, 4),
            "mean_word_f1": round(sum(r["word_f1"] for r in per_file_results) / n, 4),
            "mean_structure_score": round(sum(r["structure_score"] for r in per_file_results) / n, 4),
            "mean_composite_score": round(sum(r["composite_score"] for r in per_file_results) / n, 4),
            "total_files": n,
        }
    else:
        agg = {}

    report = {
        "per_file": per_file_results,
        "aggregate": agg,
    }

    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"\n✓ Saved cleaned markdown to {clean_output_dir}")
    print(f"✓ Saved comparison report to {report_path}")
    print(f"\nAggregate: {agg}")


if __name__ == "__main__":
    main()