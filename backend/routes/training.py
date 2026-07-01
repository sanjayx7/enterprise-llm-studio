from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Dataset, TrainingConfig
from schemas.training import TrainingConfigCreate
from config.models import AVAILABLE_MODELS



router = APIRouter(
    prefix="/training",
    tags=["Training"]
)



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