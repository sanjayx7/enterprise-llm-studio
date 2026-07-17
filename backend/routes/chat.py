import os
import uuid
import json
from typing import Optional
from fastapi import APIRouter, Depends, Body
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.connection import get_db, SessionLocal
from database.models import ChatSession, ChatMessage, TrainingJob, TrainingConfig
from services.chat_engine import chat_engine
from config.models import AVAILABLE_MODELS

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


class CreateSessionPayload(BaseModel):
    title: str
    model_id: str
    adapter_path: Optional[str] = None


class SendMessagePayload(BaseModel):
    session_id: str
    prompt: str


def save_message(db: Session, session_id: str, role: str, content: str):
    try:
        msg = ChatMessage(
            session_id=session_id,
            role=role,
            content=content
        )
        db.add(msg)
        db.commit()
    except Exception as e:
        print(f"Error saving chat message to DB: {e}")
        db.rollback()


@router.get("/models")
async def list_chat_models(db: Session = Depends(get_db)):
    try:
        # 1. Local Base Models (No Adapter)
        base_models = []
        for model in AVAILABLE_MODELS:
            base_models.append({
                "id": f"base/{model['id']}",
                "name": f"{model['name']} (Base)",
                "family": model["family"],
                "source": "local",
                "is_local": True,
                "is_adapter": False,
                "base_model": model["id"],
                "adapter_path": None
            })

        # 2. Local Custom Fine-Tuned Models (Adapters)
        jobs = (
            db.query(TrainingJob)
            .filter(TrainingJob.status == "COMPLETED")
            .filter(TrainingJob.adapter_path.isnot(None))
            .all()
        )

        custom_models = []
        for job in jobs:
            config = db.query(TrainingConfig).filter(TrainingConfig.id == job.config_id).first()
            base_model = config.model_id if config else "Unknown"
            
            custom_models.append({
                "id": f"local/job-{job.id}",
                "name": job.custom_name or f"Adapter (Job #{job.id})",
                "family": "Custom",
                "source": "local",
                "is_local": True,
                "is_adapter": True,
                "base_model": base_model,
                "adapter_path": job.adapter_path
            })

        return {
            "success": True,
            "data": base_models + custom_models
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to fetch chat models.", "error": str(e)}
        )


@router.post("/session")
async def create_session(
    payload: CreateSessionPayload,
    db: Session = Depends(get_db)
):
    try:
        session_id = str(uuid.uuid4())
        session = ChatSession(
            id=session_id,
            title=payload.title,
            model_id=payload.model_id,
            adapter_path=payload.adapter_path
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        return {
            "success": True,
            "data": {
                "id": session.id,
                "title": session.title,
                "model_id": session.model_id,
                "adapter_path": session.adapter_path,
                "created_at": session.created_at
            }
        }
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to create session.", "error": str(e)}
        )


@router.get("/sessions")
async def list_sessions(db: Session = Depends(get_db)):
    try:
        sessions = db.query(ChatSession).order_by(ChatSession.created_at.desc()).all()
        return {
            "success": True,
            "data": [
                {
                    "id": s.id,
                    "title": s.title,
                    "model_id": s.model_id,
                    "adapter_path": s.adapter_path,
                    "created_at": s.created_at
                }
                for s in sessions
            ]
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to fetch sessions.", "error": str(e)}
        )


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Session not found."}
            )

        # Delete corresponding messages
        db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
        
        db.delete(session)
        db.commit()

        return {"success": True, "message": "Session deleted successfully."}
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to delete session.", "error": str(e)}
        )


@router.get("/session/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db)
):
    try:
        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        return {
            "success": True,
            "data": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at
                }
                for m in messages
            ]
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to fetch messages.", "error": str(e)}
        )


@router.post("/send")
async def send_chat_message(
    payload: SendMessagePayload
):
    # Retrieve session details to know which model/adapter to use
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == payload.session_id).first()
        if not session:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Session not found."}
            )

        model_id = session.model_id
        adapter_path = session.adapter_path

        # 1. Save user message to database
        save_message(db, session.id, "user", payload.prompt)

        # 2. Retrieve history messages (limit to last 10 messages for context)
        history_msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .filter(ChatMessage.content != payload.prompt) # Exclude the current prompt we just added
            .order_by(ChatMessage.created_at.desc())
            .limit(10)
            .all()
        )
        history_msgs.reverse() # Order by oldest first

        formatted_history = []
        for hm in history_msgs:
            formatted_history.append({"role": hm.role, "content": hm.content})

        # Intercept generator to save assistant response when streaming completes
        def response_generator():
            full_response = ""
            
            # Check if it is a direct base model (starts with "base/")
            if model_id.startswith("base/"):
                base_model_id = model_id.replace("base/", "")
            else:
                # For local custom models, we need a base model ID (e.g. Qwen, Llama).
                # We can determine the base model ID by looking at the adapter path or configuration
                base_model_id = "Qwen/Qwen2.5-0.5B-Instruct" # Fallback default
                
                # Check if it is a local adapter registered in TrainingConfig
                if session.adapter_path:
                    # Search job
                    job = db.query(TrainingJob).filter(TrainingJob.adapter_path == session.adapter_path).first()
                    if job:
                        config = db.query(TrainingConfig).filter(TrainingConfig.id == job.config_id).first()
                        if config and config.model_id:
                            base_model_id = config.model_id

            stream = chat_engine.generate_local_stream(base_model_id, adapter_path, formatted_history, payload.prompt)

            for chunk_data in stream:
                yield chunk_data
                
                # Parse text to save in DB on completion
                if chunk_data.startswith("data: ") and not chunk_data.startswith("data: [DONE]"):
                    try:
                        parsed = json.loads(chunk_data[6:].strip())
                        if "error" in parsed:
                            full_response = parsed["error"]
                        elif "choices" in parsed and len(parsed["choices"]) > 0:
                            content = parsed["choices"][0].get("delta", {}).get("content", "")
                            full_response += content
                    except Exception:
                        pass

            # Save the final compiled text to the DB
            if full_response:
                local_db = SessionLocal()
                try:
                    save_message(local_db, session.id, "assistant", full_response)
                finally:
                    local_db.close()

        return StreamingResponse(
            response_generator(),
            media_type="text/event-stream"
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to initiate response generation.", "error": str(e)}
        )
    finally:
        db.close()
