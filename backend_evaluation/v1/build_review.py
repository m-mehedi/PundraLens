import base64
import glob
import html
import json
from pathlib import Path


def find_image(stem: str, eval_dir: Path) -> Path | None:
    for ext in (".jpg", ".jpeg", ".png"):
        candidate = eval_dir / f"{stem}{ext}"
        if candidate.exists():
            return candidate
    return None


def image_to_data_uri(path: Path) -> str:
    suffix = path.suffix.lower().lstrip(".")
    mime = "image/jpeg" if suffix in ("jpg", "jpeg") else f"image/{suffix}"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def main():
    eval_dir = Path("../evaluation_files")
    md_dir = Path("../output_clean")
    json_dir = Path("../extracted")
    output_path = Path("../review.html")

    stems = sorted(
        (p.stem for p in json_dir.glob("*.json") if not p.name.startswith("_")),
        key=lambda s: int(s) if s.isdigit() else s,
    )
    print(f"Found {len(stems)} notice(s)")

    sections = []
    for stem in stems:
        img_path = find_image(stem, eval_dir)
        img_html = (
            f'<img src="{image_to_data_uri(img_path)}" alt="notice {stem}">'
            if img_path
            else '<p class="missing">No image found</p>'
        )

        md_path = md_dir / f"{stem}.md"
        md_text = md_path.read_text(encoding="utf-8") if md_path.exists() else "(no markdown)"

        json_path = json_dir / f"{stem}.json"
        if json_path.exists():
            json_text = json.dumps(
                json.loads(json_path.read_text(encoding="utf-8")),
                indent=2,
                ensure_ascii=False,
            )
        else:
            json_text = "(no json)"

        sections.append(f"""
  <section id="notice-{stem}">
    <h2>{stem}</h2>
    <div class="row">
      <div class="col">
        <div class="col-head">Photo</div>
        <div class="photo">{img_html}</div>
      </div>
      <div class="col">
        <div class="col-head">Markdown</div>
        <pre>{html.escape(md_text)}</pre>
      </div>
      <div class="col">
        <div class="col-head">Extracted JSON</div>
        <pre>{html.escape(json_text)}</pre>
      </div>
    </div>
  </section>""")

    nav = " ".join(f'<a href="#notice-{s}">{s}</a>' for s in stems)

    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Notice Review</title>
<style>
  :root {{
    --border: #d0d7de;
    --bg: #f6f8fa;
    --head-bg: #eaeef2;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    padding: 1.5rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Noto Sans Bengali", sans-serif;
    color: #1f2328;
    background: #fff;
  }}
  h1 {{ margin-top: 0; }}
  .nav {{
    position: sticky;
    top: 0;
    background: #fff;
    padding: .5rem 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 1rem;
    z-index: 10;
    line-height: 1.9;
  }}
  .nav a {{
    display: inline-block;
    padding: .1rem .5rem;
    margin: 0 .15rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    text-decoration: none;
    color: #0969da;
    font-size: .85rem;
  }}
  .nav a:hover {{ background: var(--bg); }}
  section {{ margin-bottom: 2.5rem; }}
  section h2 {{
    border-bottom: 2px solid var(--border);
    padding-bottom: .25rem;
  }}
  .row {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    align-items: start;
  }}
  .col {{ min-width: 0; }}
  .col-head {{
    font-size: .75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: #57606a;
    background: var(--head-bg);
    padding: .35rem .6rem;
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
  }}
  pre, .photo {{
    margin: 0;
    border: 1px solid var(--border);
    border-radius: 0 0 6px 6px;
    background: var(--bg);
  }}
  pre {{
    padding: .75rem;
    overflow: auto;
    max-height: 80vh;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-size: .8rem;
    line-height: 1.5;
  }}
  .photo {{
    display: flex;
    justify-content: center;
    max-height: 80vh;
    overflow: auto;
    padding: .5rem;
  }}
  .photo img {{
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }}
  .missing {{ color: #cf222e; }}
  @media (max-width: 900px) {{
    .row {{ grid-template-columns: 1fr; }}
    pre, .photo {{ max-height: none; }}
  }}
</style>
</head>
<body>
<h1>Notice Review</h1>
<div class="nav">{nav}</div>
{''.join(sections)}
</body>
</html>"""

    output_path.write_text(doc, encoding="utf-8")
    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"✓ Saved {output_path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()