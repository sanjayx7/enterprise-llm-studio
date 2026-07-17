import os
import shutil
import uuid
import json
import zipfile
from fastapi import APIRouter, Depends, BackgroundTasks, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.connection import get_db
from database.models import TrainingJob, TrainingConfig
from config.models import AVAILABLE_MODELS

router = APIRouter(
    prefix="/model",
    tags=["Model"]
)


class RenameModelPayload(BaseModel):
    name: str


def get_dir_size_kb(path):
    total = 0
    if not os.path.exists(path):
        return 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                total += os.path.getsize(fp)
            except OSError:
                pass
    return round(total / 1024, 2)


@router.get("/list")
async def list_models():
    return {
        "success": True,
        "message": "Models fetched successfully.",
        "data": AVAILABLE_MODELS
    }


@router.get("/trained")
async def list_trained_models(db: Session = Depends(get_db)):
    try:
        # Fetch completed training jobs that have an adapter path
        jobs = (
            db.query(TrainingJob)
            .filter(TrainingJob.status == "COMPLETED")
            .filter(TrainingJob.adapter_path.isnot(None))
            .order_by(TrainingJob.completed_at.desc())
            .all()
        )

        data = []
        for job in jobs:
            # Try to fetch original config
            config = db.query(TrainingConfig).filter(TrainingConfig.id == job.config_id).first()
            base_model_id = config.model_id if config else "Unknown"
            epochs = config.epochs if config else None
            
            # Compute file size of adapter folder
            size_kb = 0.0
            if job.adapter_path and os.path.exists(job.adapter_path):
                size_kb = get_dir_size_kb(job.adapter_path)

            data.append({
                "job_id": job.id,
                "config_id": job.config_id,
                "custom_name": job.custom_name or f"Model Adapter (Job #{job.id})",
                "base_model": base_model_id,
                "status": job.status,
                "epochs": epochs,
                "loss": job.loss,
                "size_kb": size_kb,
                "adapter_path": job.adapter_path,
                "completed_at": job.completed_at
            })

        return {
            "success": True,
            "message": "Trained models fetched successfully.",
            "data": data
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to fetch trained models.",
                "error": str(e)
            }
        )


@router.post("/{job_id}/rename")
async def rename_model(
    job_id: int,
    payload: RenameModelPayload,
    db: Session = Depends(get_db)
):
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Model not found."}
            )

        job.custom_name = payload.name
        db.commit()

        return {
            "success": True,
            "message": "Model renamed successfully.",
            "data": {"job_id": job_id, "custom_name": payload.name}
        }
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to rename model.", "error": str(e)}
        )


@router.delete("/{job_id}")
async def delete_model(
    job_id: int,
    db: Session = Depends(get_db)
):
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Model not found."}
            )

        # Remove adapter folder from disk
        if job.adapter_path and os.path.exists(job.adapter_path):
            try:
                shutil.rmtree(job.adapter_path)
            except Exception as rmtree_err:
                print(f"Error removing directory: {rmtree_err}")

        # Delete database job record
        db.delete(job)
        db.commit()

        return {
            "success": True,
            "message": "Model deleted successfully."
        }
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to delete model.", "error": str(e)}
        )


@router.get("/{job_id}/download")
async def download_model(
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Model not found."}
            )

        if not job.adapter_path or not os.path.exists(job.adapter_path):
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Adapter files not found on disk."}
            )

        # Create temporary zip file
        temp_dir = os.path.join("trained_models", "temp_downloads")
        os.makedirs(temp_dir, exist_ok=True)
        zip_filename = f"adapter_job_{job_id}_{uuid.uuid4().hex[:8]}.zip"
        zip_filepath = os.path.join(temp_dir, zip_filename)

        # Archive directory
        shutil.make_archive(zip_filepath.replace(".zip", ""), "zip", job.adapter_path)

        # Add background task to delete the zip file after sending
        background_tasks.add_task(os.remove, zip_filepath)

        display_name = f"{job.custom_name.replace(' ', '_')}_adapter.zip" if job.custom_name else f"adapter_job_{job_id}.zip"

        return FileResponse(
            path=zip_filepath,
            filename=display_name,
            media_type="application/zip"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to package adapter.", "error": str(e)}
        )


@router.post("/upload")
async def upload_model_adapter(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    temp_zip = None
    extract_dir = None
    try:
        if not file.filename.endswith(".zip"):
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Only adapter ZIP archives are supported."}
            )

        # Save uploaded zip temporarily
        temp_dir = os.path.join("trained_models", "temp_uploads")
        os.makedirs(temp_dir, exist_ok=True)
        temp_zip_name = f"{uuid.uuid4().hex}.zip"
        temp_zip = os.path.join(temp_dir, temp_zip_name)

        with open(temp_zip, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Create unique extract directory
        model_id_hex = uuid.uuid4().hex[:12]
        extract_dir = os.path.join("trained_models", f"uploaded_{model_id_hex}")
        os.makedirs(extract_dir, exist_ok=True)

        # Extract archive
        with zipfile.ZipFile(temp_zip, "r") as zip_ref:
            zip_ref.extractall(extract_dir)

        # Validate extraction: it must contain adapter_config.json
        config_path = os.path.join(extract_dir, "adapter_config.json")
        if not os.path.exists(config_path):
            # Check if it was nested in a subdirectory inside the zip
            items = os.listdir(extract_dir)
            if len(items) == 1 and os.path.isdir(os.path.join(extract_dir, items[0])):
                # Move contents up
                nested_dir = os.path.join(extract_dir, items[0])
                for sub_item in os.listdir(nested_dir):
                    shutil.move(os.path.join(nested_dir, sub_item), extract_dir)
                os.rmdir(nested_dir)

        if not os.path.exists(config_path):
            shutil.rmtree(extract_dir)
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Invalid ZIP. No adapter_config.json found."}
            )

        # Read base model from adapter config
        base_model = "Unknown Base Model"
        try:
            with open(config_path, "r") as f:
                adapter_conf = json.load(f)
                base_model = adapter_conf.get("base_model_name_or_path", base_model)
        except Exception:
            pass

        # Create dummy TrainingConfig
        config = TrainingConfig(
            dataset_id=0,
            model_id=base_model,
            epochs=1,
            batch_size=1,
            learning_rate=0.0001,
            lora_rank=8,
            lora_alpha=16,
            lora_dropout=0.05,
            max_sequence_length=512
        )
        db.add(config)
        db.commit()
        db.refresh(config)

        # Create TrainingJob record as completed
        job = TrainingJob(
            config_id=config.id,
            status="COMPLETED",
            progress=100.0,
            loss=0.0,
            current_epoch=1,
            current_step=1,
            adapter_path=extract_dir,
            custom_name=file.filename.replace(".zip", ""),
            logs="Uploaded model adapter registered successfully.\n"
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        return {
            "success": True,
            "message": "Model adapter uploaded and registered successfully.",
            "data": {
                "job_id": job.id,
                "custom_name": job.custom_name,
                "base_model": base_model
            }
        }

    except Exception as e:
        if extract_dir and os.path.exists(extract_dir):
            shutil.rmtree(extract_dir)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to upload adapter.", "error": str(e)}
        )
    finally:
        # Clean up temporary zip
        if temp_zip and os.path.exists(temp_zip):
            try:
                os.remove(temp_zip)
            except Exception:
                pass