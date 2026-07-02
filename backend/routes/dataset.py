import json
import os
import shutil
import uuid

import pandas as pd

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Dataset


router = APIRouter(prefix="/dataset", tags=["Dataset"])

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {".csv", ".json", ".jsonl", ".parquet"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:

        extension = os.path.splitext(file.filename)[1].lower()

        if extension not in ALLOWED_EXTENSIONS:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Only CSV, JSON, JSONL, and Parquet files are supported."
                }
            )

        unique_name = f"{uuid.uuid4().hex}{extension}"

        filepath = os.path.join(
            UPLOAD_FOLDER,
            unique_name
        )

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            if extension == ".csv":
                df = pd.read_csv(filepath)
            elif extension == ".json":
                df = pd.read_json(filepath)
            elif extension == ".jsonl":
                df = pd.read_json(filepath, lines=True)
            elif extension == ".parquet":
                df = pd.read_parquet(filepath)
            else:
                raise Exception("Unsupported format")

            required_columns = {"instruction", "input", "output"}
            if not required_columns.issubset(df.columns):
                os.remove(filepath)
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "message": "Unsupported dataset format. Please upload an instruction tuning dataset."
                    }
                )
        except Exception as read_err:
            if os.path.exists(filepath):
                os.remove(filepath)
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Unsupported dataset format. Please upload an instruction tuning dataset."
                }
            )

        dataset = Dataset(
            original_filename=file.filename,
            stored_filename=unique_name,
            filepath=filepath,
            file_type=extension.replace(".", "").upper(),
            file_size=os.path.getsize(filepath)
        )

        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        return {
            "success": True,
            "message": "Dataset uploaded successfully.",
            "data": {
                "id": dataset.id,
                "filename": dataset.original_filename
            }
        }

    except Exception as e:
        db.rollback()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to upload dataset.",
                "error": str(e)
            }
        )


@router.get("/list")
async def list_datasets(
    db: Session = Depends(get_db)
):
    try:

        datasets = db.query(Dataset).all()

        return {
            "success": True,
            "message": "Datasets fetched successfully.",
            "data": [
                {
                    "id": d.id,
                    "filename": d.original_filename,
                    "type": d.file_type,
                    "size_kb": round(d.file_size / 1024, 2),
                    "uploaded_at": d.created_at
                }
                for d in datasets
            ]
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

@router.get("/preview/{dataset_id}")
async def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    try:

        dataset = (
            db.query(Dataset)
            .filter(Dataset.id == dataset_id)
            .first()
        )

        if not dataset:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Dataset not found."
                }
            )

        filepath = dataset.filepath
        extension = os.path.splitext(filepath)[1].lower()

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

        # Parquet Preview
        elif extension == ".parquet":

            df = pd.read_parquet(filepath)

            return {
                "success": True,
                "message": "Dataset preview fetched successfully.",
                "data": {
                    "columns": df.columns.tolist(),
                    "rows": df.head(10).to_dict(orient="records")
                }
            }

        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "Unsupported dataset format."
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


@router.post("/validate/{dataset_id}")
async def validate_dataset(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    try:

        dataset = (
            db.query(Dataset)
            .filter(Dataset.id == dataset_id)
            .first()
        )

        if not dataset:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Dataset not found."
                }
            )

        filepath = dataset.filepath

        if not os.path.exists(filepath):
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Dataset file not found."
                }
            )

        extension = os.path.splitext(filepath)[1].lower()

        result = {
            "valid": True,
            "total_rows": 0,
            "duplicate_rows": 0,
            "empty_rows": 0,
            "issues": []
        }

        # ---------------- CSV ---------------- #

        if extension == ".csv":

            df = pd.read_csv(filepath)

            result["total_rows"] = len(df)

            if df.empty:
                result["valid"] = False
                result["issues"].append("Dataset is empty.")

            required_columns = {"instruction", "input", "output"}
            if not required_columns.issubset(df.columns):
                result["valid"] = False
                result["issues"].append(
                    "Unsupported dataset format. Please upload an instruction tuning dataset."
                )

            duplicate_rows = df.duplicated().sum()
            result["duplicate_rows"] = int(duplicate_rows)

            if duplicate_rows > 0:
                result["issues"].append(
                    f"{duplicate_rows} duplicate rows found."
                )

            empty_rows = df.isnull().all(axis=1).sum()
            result["empty_rows"] = int(empty_rows)

            if empty_rows > 0:
                result["issues"].append(
                    f"{empty_rows} empty rows found."
                )

            missing_columns = [
                col for col in df.columns
                if str(col).strip() == ""
            ]

            if missing_columns:
                result["valid"] = False
                result["issues"].append(
                    "Dataset contains unnamed columns."
                )

        # ---------------- JSON ---------------- #

        elif extension == ".json":

            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, list):

                result["total_rows"] = len(data)

                if len(data) == 0:
                    result["valid"] = False
                    result["issues"].append("Dataset is empty.")
                else:
                    first_item = data[0]
                    if isinstance(first_item, dict):
                        required_columns = {"instruction", "input", "output"}
                        if not required_columns.issubset(first_item.keys()):
                            result["valid"] = False
                            result["issues"].append(
                                "Unsupported dataset format. Please upload an instruction tuning dataset."
                            )
                    else:
                        result["valid"] = False
                        result["issues"].append(
                            "Unsupported dataset format. Please upload an instruction tuning dataset."
                        )

            else:
                result["total_rows"] = 1
                result["valid"] = False
                result["issues"].append(
                    "Unsupported dataset format. Please upload an instruction tuning dataset."
                )

        # ---------------- JSONL ---------------- #

        elif extension == ".jsonl":

            total_rows = 0

            with open(filepath, "r", encoding="utf-8") as f:

                for line_number, line in enumerate(f, start=1):

                    if not line.strip():
                        continue

                    try:
                        obj = json.loads(line)
                        total_rows += 1
                        if total_rows == 1:
                            required_columns = {"instruction", "input", "output"}
                            if not isinstance(obj, dict) or not required_columns.issubset(obj.keys()):
                                result["valid"] = False
                                result["issues"].append(
                                    "Unsupported dataset format. Please upload an instruction tuning dataset."
                                )

                    except json.JSONDecodeError:
                        result["valid"] = False
                        result["issues"].append(
                            f"Invalid JSON at line {line_number}."
                        )

            result["total_rows"] = total_rows

            if total_rows == 0:
                result["valid"] = False
                result["issues"].append("Dataset is empty.")

        # ---------------- Parquet ---------------- #

        elif extension == ".parquet":

            df = pd.read_parquet(filepath)

            result["total_rows"] = len(df)

            if df.empty:
                result["valid"] = False
                result["issues"].append("Dataset is empty.")

            required_columns = {"instruction", "input", "output"}
            if not required_columns.issubset(df.columns):
                result["valid"] = False
                result["issues"].append(
                    "Unsupported dataset format. Please upload an instruction tuning dataset."
                )

            duplicate_rows = df.duplicated().sum()
            result["duplicate_rows"] = int(duplicate_rows)

            if duplicate_rows > 0:
                result["issues"].append(
                    f"{duplicate_rows} duplicate rows found."
                )

            empty_rows = df.isnull().all(axis=1).sum()
            result["empty_rows"] = int(empty_rows)

            if empty_rows > 0:
                result["issues"].append(
                    f"{empty_rows} empty rows found."
                )

            missing_columns = [
                col for col in df.columns
                if str(col).strip() == ""
            ]

            if missing_columns:
                result["valid"] = False
                result["issues"].append(
                    "Dataset contains unnamed columns."
                )

        else:

            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Unsupported dataset format."
                }
            )

        return {
            "success": True,
            "message": "Dataset validation completed.",
            "data": result
        }

    except Exception as e:

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Dataset validation failed.",
                "error": str(e)
            }
        )
