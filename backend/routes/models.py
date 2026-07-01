from fastapi import APIRouter

from config.models import AVAILABLE_MODELS

router = APIRouter(
    prefix="/model",
    tags=["Model"]
)


@router.get("/list")
async def list_models():

    return {
        "success": True,
        "message": "Models fetched successfully.",
        "data": AVAILABLE_MODELS
    }