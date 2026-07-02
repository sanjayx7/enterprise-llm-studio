from fastapi import FastAPI
from routes.dataset import router as dataset_router
from sqlalchemy.orm import declarative_base
from database.connection import Base, engine
from database.models import Dataset
from routes.training import router as training_router
from routes.model import router as models_router

app = FastAPI(title="Enterprise LLM Studio")


Base.metadata.create_all(bind=engine)


app.include_router(dataset_router)
app.include_router(training_router)
app.include_router(models_router)


@app.get("/")
def home():
    return {"message": "Enterprise LLM Studio API is running"}