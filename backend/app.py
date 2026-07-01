from fastapi import FastAPI

app = FastAPI(title="Enterprise LLM Studio")


@app.get("/")
def home():
    return {"message": "Enterprise LLM Studio API is running"}