from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
import os
import shutil
import json
import pandas as pd


router = APIRouter(prefix="/dataset", tags=["Dataset"])

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {".csv", ".json", ".jsonl"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    try:
        # Check file extension
        extension = os.path.splitext(file.filename)[1].lower()

        if extension not in ALLOWED_EXTENSIONS:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Only CSV, JSON and JSONL files are supported."
                }
            )

        # Save uploaded file
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {
            "success": True,
            "message": "Dataset uploaded successfully.",
            "data": {
                "filename": file.filename
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to upload dataset.",
                "error": str(e)
            }
        )


@router.get("/list")
async def list_datasets():
    try:
        datasets = []

        for filename in os.listdir(UPLOAD_FOLDER):
            filepath = os.path.join(UPLOAD_FOLDER, filename)

            if os.path.isfile(filepath):
                datasets.append({
                    "filename": filename,
                    "size_kb": round(os.path.getsize(filepath) / 1024, 2),
                    "type": os.path.splitext(filename)[1].replace(".", "").upper()
                })

        return {
            "success": True,
            "message": "Datasets fetched successfully.",
            "data": datasets
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to fetch datasets.",
                "error": str(e)
            }
        )        



@router.get("/preview/{filename}")
async def preview_dataset(filename: str):
    try:
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        if not os.path.exists(filepath):
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Dataset not found."
                }
            )

        extension = os.path.splitext(filename)[1].lower()

        # CSV Preview
        if extension == ".csv":
            df = pd.read_csv(filepath)

            return {
                "success": True,
                "message": "Dataset preview fetched successfully.",
                "data": {
                    "columns": df.columns.tolist(),
                    "rows": df.head(10).to_dict(orient="records")
                }
            }

        # JSON Preview
        elif extension == ".json":
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, list):
                preview = data[:10]
            else:
                preview = [data]

            return {
                "success": True,
                "message": "Dataset preview fetched successfully.",
                "data": preview
            }

        # JSONL Preview
        elif extension == ".jsonl":
            preview = []

            with open(filepath, "r", encoding="utf-8") as f:
                for i, line in enumerate(f):
                    if i >= 10:
                        break
                    preview.append(json.loads(line))

            return {
                "success": True,
                "message": "Dataset preview fetched successfully.",
                "data": preview
            }

        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "Unsupported file format."
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to preview dataset.",
                "error": str(e)
            }
        )        