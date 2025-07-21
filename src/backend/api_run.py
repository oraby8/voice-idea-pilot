from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import File, Form, UploadFile
from service import *
from pydantic import BaseModel
import uuid
import os
from typing import Optional , List


# Initialize FastAPI app
app = FastAPI(title="Idea Submission API")

# CORS configuration (adjust for your frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for API request/response
class SubmissionRequest(BaseModel):
    audio: Optional[UploadFile] = None
    text: Optional[str] = None
    session_id: Optional[str] = None

class ClarificationRequest(BaseModel):
    response: str
    session_id: str

class FormFieldResponse(BaseModel):
    idea_title: Optional[str] = None
    solution_details: Optional[str] = None
    benefits_and_impact: Optional[str] = None
    impact_measures: Optional[str] = None
    scalability: Optional[str] = None
    target_audience: Optional[str] = None
    relevant_entities: Optional[str] = None
    feasibility_and_implementation: Optional[str] = None

class APIResponse(BaseModel):
    status: str  # "complete" | "needs_clarification" | "error"
    form_data: FormFieldResponse
    message: Optional[str] = None
    missing_fields: Optional[List[str]] = None
    session_id: Optional[str] = None

# Initialize our DSPy processor (from previous implementation)
assistant = IterativeIdeaSubmissionAssistant()

# Temporary storage for sessions (use Redis in production)
sessions = {}


@app.post("/start_submission", response_model=APIResponse)
async def start_submission(
    audio: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None)
):
    """Endpoint for initial idea submission"""
    try:
        session_id = session_id or str(uuid.uuid4())
        
        # Process either audio or text input
        if audio:
            # Save audio temporarily
            audio_path = f"temp_audio/{session_id}.mp3"
            os.makedirs(os.path.dirname(audio_path), exist_ok=True)
            with open(audio_path, "wb") as buffer:
                buffer.write(await audio.read())
            
            # Process through assistant
            status_code , output_json = await transcript(audio_path,audio_path.split('/')[-1])
            if status_code == 200:
                departments_text = output_json["transcript"]
            result = assistant.run_interactive_loop(departments_text)
            os.remove(audio_path)
            
        elif text:
            result = assistant.run_interactive_loop(text)
        else:
            raise HTTPException(status_code=400, detail="Either audio or text input required")
        
        # Store session state
        sessions[session_id] = {
            "current_fields": result["form_data"],
            "history": []
        }
        
        # Prepare API response
        return APIResponse(
            status=result["status"],
            form_data=FormFieldResponse(**result["form_data"]),
            missing_fields=[f["field"] for f in result.get("validation", {}).get("missing_fields", [])],
            session_id=session_id,
            message=result.get("prompt", "")
        )
        
    except Exception as e:
        print("error")
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/provide_clarification", response_model=APIResponse)
async def provide_clarification(audio: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None)):
    """Endpoint for follow-up clarifications"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get current session state
        session = sessions[session_id]

        if audio:
            # Save audio temporarily
            audio_path = f"temp_audio/{session_id}.mp3"
            os.makedirs(os.path.dirname(audio_path), exist_ok=True)
            with open(audio_path, "wb") as buffer:
                buffer.write(await audio.read())
            
            # Process through assistant
            status_code , output_json = await transcript(audio_path,audio_path.split('/')[-1])
            if status_code == 200:
                departments_text = output_json["transcript"]
                print(departments_text)
            text = departments_text
            os.remove(audio_path)

        
        # Process clarification
        updated_fields = assistant._update_fields(
            session["current_fields"],
            str(text)
        )
        
        # Validate
        validation = assistant.validator.validate_fields(updated_fields)
        
        # Update session
        session["current_fields"] = updated_fields
        session["history"].append({
            "response": str(text),
            "validation": validation
        })
        # Prepare response
        status = "complete" if not validation["missing_fields"] else "needs_clarification"
        
        return APIResponse(
            status=status,
            form_data=FormFieldResponse(**updated_fields),
            missing_fields=[f["field"] for f in validation.get("missing_fields", [])],
            session_id=session_id,
            message=None#assistant._generate_user_prompt(validation) if status == "needs_clarification" else None
        )
        
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/submission_status/{session_id}", response_model=APIResponse)
async def get_status(session_id: str):
    """Check submission status"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    validation = assistant.validator.validate_fields(session["current_fields"])
    
    return APIResponse(
        status="complete" if not validation["missing_fields"] else "needs_clarification",
        form_data=FormFieldResponse(**session["current_fields"]),
        session_id=session_id
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=2000)



