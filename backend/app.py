from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.dataset import router as dataset_router
from sqlalchemy.orm import declarative_base
from database.connection import Base, engine
from database.models import Dataset, ChatSession, ChatMessage
from routes.training import router as training_router
from routes.model import router as models_router
from routes.chat import router as chat_router

app = FastAPI(title="Enterprise LLM Studio")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


app.include_router(dataset_router)
app.include_router(training_router)
app.include_router(models_router)
app.include_router(chat_router)


@app.get("/")
def home():
    return {"message": "Enterprise LLM Studio API is running"}