from pathlib import Path
from datalab_sdk import DatalabClient, ConvertOptions

client = DatalabClient(api_key="2dUNAJdoWmKSXkU1mpasc5LTSlYREe54zVNYLTVe0Sc")

options = ConvertOptions(
    mode="balanced",
    output_format="markdown",
    disable_image_extraction=True,
    disable_image_captions=True
)
def main():
    eval_dir = Path("../evaluation_files")
    output_dir = Path("../output")
    output_dir.mkdir(exist_ok=True)

    image_extensions = {".jpg", ".jpeg", ".png"}
    image_files = [
        f for f in eval_dir.iterdir()
        if f.is_file() and f.suffix.lower() in image_extensions
    ]

    print(f"Found {len(image_files)} image(s) to process")

    for image_path in image_files:
        try:
            print(f"Processing: {image_path.name}")
            result = client.convert(str(image_path), options=options)

            output_path = output_dir / f"{image_path.stem}.md"
            with open(output_path, "w") as f:
                f.write(result.markdown)

            print(f"  ✓ Saved to {output_path}")

        except Exception as e:
            print(f"  ✗ Failed to process {image_path.name}: {e}")

    print("\nDone!")


if __name__ == "__main__":
    main()
