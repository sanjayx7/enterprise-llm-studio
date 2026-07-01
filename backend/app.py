from fastapi import FastAPI
from routes.dataset import router as dataset_router

app = FastAPI(title="Enterprise LLM Studio")

app.include_router(dataset_router)


@app.get("/")
def home():
    return {"message": "Enterprise LLM Studio API is running"}