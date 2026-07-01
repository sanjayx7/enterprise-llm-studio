from fastapi import FastAPI
from routes.dataset import router as dataset_router
from sqlalchemy.orm import declarative_base
from database.connection import Base, engine
from database.models import Dataset

app = FastAPI(title="Enterprise LLM Studio")


Base.metadata.create_all(bind=engine)


app.include_router(dataset_router)


@app.get("/")
def home():
    return {"message": "Enterprise LLM Studio API is running"}