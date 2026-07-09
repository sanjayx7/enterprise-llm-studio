import traceback
from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from database.connection import get_db, SessionLocal
from database.models import Dataset, TrainingConfig, TrainingJob
from schemas.training import TrainingConfigCreate
from config.models import AVAILABLE_MODELS
from services.trainer import prepare_training
from services.trainer_engine import create_trainer


router = APIRouter(
    prefix="/training",
    tags=["Training"]
)


def run_training_background(job_id: int, config_id: int):
    db = SessionLocal()
    try:
        # Fetch configuration and dataset
        config = db.query(TrainingConfig).filter(TrainingConfig.id == config_id).first()
        if not config:
            raise Exception("Training configuration not found.")
            
        dataset_record = db.query(Dataset).filter(Dataset.id == config.dataset_id).first()
        if not dataset_record:
            raise Exception("Dataset record not found.")

        # Update status to PREPARING
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job:
            job.status = "PREPARING"
            job.logs = "Preparing training (loading model and tokenizer, formatting dataset)...\n"
            db.commit()

        model, tokenizer, train_dataset = prepare_training(
            config.model_id,
            dataset_record.filepath,
            config.max_sequence_length,
            config.lora_rank,
            config.lora_alpha,
            config.lora_dropout
        )

        trainer = create_trainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=train_dataset,
            config=config,
            job_id=job_id
        )

        # Update log
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job:
            job.logs = (job.logs or "") + "Model loaded. Starting training loops...\n"
            db.commit()

        trainer.train()

        save_path = f"trained_models/config_{config.id}"
        trainer.save_model(save_path)
        tokenizer.save_pretrained(save_path)

        # Update final job state (in case callback didn't finish it)
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job:
            job.status = "COMPLETED"
            job.progress = 100.0
            job.adapter_path = save_path
            job.completed_at = func.now()
            job.logs = (job.logs or "") + f"Training finished successfully. Saved adapter to {save_path}\n"
            db.commit()

    except Exception as e:
        print(f"Background training failed: {e}")
        traceback.print_exc()
        db.rollback()
        # Update job to FAILED
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job:
            job.status = "FAILED"
            job.completed_at = func.now()
            job.logs = (job.logs or "") + f"\nERROR DURING TRAINING:\n{str(e)}\n{traceback.format_exc()}\n"
            db.commit()
    finally:
        db.close()


@router.post("/config")
async def create_training_config(
    payload: TrainingConfigCreate,
    db: Session = Depends(get_db)
):
    try:

        # Check dataset
        dataset = (
            db.query(Dataset)
            .filter(Dataset.id == payload.dataset_id)
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

        # Check model
        model_exists = any(
            model["id"] == payload.model_id
            for model in AVAILABLE_MODELS
        )

        if not model_exists:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Selected model not found."
                }
            )

        config = TrainingConfig(
            dataset_id=payload.dataset_id,
            model_id=payload.model_id,
            epochs=payload.epochs,
            batch_size=payload.batch_size,
            learning_rate=payload.learning_rate,
            lora_rank=payload.lora_rank,
            lora_alpha=payload.lora_alpha,
            lora_dropout=payload.lora_dropout,
            max_sequence_length=payload.max_sequence_length
        )

        db.add(config)
        db.commit()
        db.refresh(config)

        return {
            "success": True,
            "message": "Training configuration created successfully.",
            "data": {
                "config_id": config.id
            }
        }

    except Exception as e:

        db.rollback()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to create training configuration.",
                "error": str(e)
            }
        )


@router.post("/start/{config_id}")
async def start_training(
    config_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    try:
        config = (
            db.query(TrainingConfig)
            .filter(TrainingConfig.id == config_id)
            .first()
        )

        if not config:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Training configuration not found."
                }
            )

        dataset_record = (
            db.query(Dataset)
            .filter(Dataset.id == config.dataset_id)
            .first()
        )

        if not dataset_record:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Dataset not found."
                }
            )

        # Create a training job entry
        job = TrainingJob(
            config_id=config_id,
            status="PENDING",
            progress=0.0,
            loss=0.0,
            current_epoch=0,
            current_step=0,
            logs="Initializing job...\n"
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        background_tasks.add_task(run_training_background, job.id, config_id)

        return {
            "success": True,
            "message": "Training job initiated in the background.",
            "data": {
                "job_id": job.id,
                "config_id": config_id,
                "status": job.status
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to initiate training job.",
                "error": str(e)
            }
        )


@router.get("/jobs")
async def list_training_jobs(
    db: Session = Depends(get_db)
):
    try:
        jobs = db.query(TrainingJob).order_by(TrainingJob.started_at.desc()).all()
        return {
            "success": True,
            "message": "Training jobs fetched successfully.",
            "data": [
                {
                    "id": job.id,
                    "config_id": job.config_id,
                    "status": job.status,
                    "current_epoch": job.current_epoch,
                    "current_step": job.current_step,
                    "loss": job.loss,
                    "progress": job.progress,
                    "adapter_path": job.adapter_path,
                    "started_at": job.started_at,
                    "completed_at": job.completed_at
                }
                for job in jobs
            ]
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to fetch training jobs.",
                "error": str(e)
            }
        )


@router.get("/jobs/{job_id}")
async def get_training_job(
    job_id: int,
    db: Session = Depends(get_db)
):
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Training job not found."
                }
            )
        return {
            "success": True,
            "message": "Training job fetched successfully.",
            "data": {
                "id": job.id,
                "config_id": job.config_id,
                "status": job.status,
                "current_epoch": job.current_epoch,
                "current_step": job.current_step,
                "loss": job.loss,
                "progress": job.progress,
                "adapter_path": job.adapter_path,
                "logs": job.logs,
                "started_at": job.started_at,
                "completed_at": job.completed_at
            }
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to fetch training job details.",
                "error": str(e)
            }
        )