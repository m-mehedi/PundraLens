from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from service.api import dependencies
from service.core.exceptions import ExtractionFailure, OCRFailure, UnsupportedFileType
from service.core.pipeline import process_file, process_text
from service.core.schema import ExtractionSchema

app = FastAPI(
    title="Pundra Notice Extractor",
    description="Extract structured data from notice images, PDFs, or raw text.",
    version="1.0.0",
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractionSchema)
async def extract(
    file: UploadFile | None = File(None, description="Notice image (.jpg/.jpeg/.png) or PDF"),
    text: str | None = Form(None, description="Raw notice text (skips OCR)"),
) -> ExtractionSchema:
    """Extract structured notice data.

    Provide exactly one input:
    - `file`: an image or PDF, which goes through OCR first.
    - `text`: raw text, which skips OCR and is extracted directly.
    """
    if file is not None and text is not None:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'file' or 'text', not both.",
        )
    if file is None and text is None:
        raise HTTPException(
            status_code=400,
            detail="Provide one of 'file' or 'text'.",
        )

    extractor = dependencies.get_extractor()

    try:
        if file is not None:
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            result = await run_in_threadpool(
                process_file, data, file.filename or "upload", extractor
            )
        else:
            result = await run_in_threadpool(process_text, text, extractor)

    except UnsupportedFileType as e:
        raise HTTPException(status_code=415, detail=str(e))
    except OCRFailure as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ExtractionFailure as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result