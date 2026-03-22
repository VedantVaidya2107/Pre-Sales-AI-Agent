from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime
from utils import store

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class PassRequest(BaseModel):
    email: str
    password: str

@router.get("/check")
def check_auth(email: str):
    if not email:
        raise HTTPException(status_code=400, detail="email required")
    email_lower = email.lower()
    if not email_lower.endswith("@fristinetech.com"):
        raise HTTPException(status_code=403, detail="Access restricted to @fristinetech.com accounts")
        
    agents = store.read("agents.json", {})
    agent = agents.get(email_lower, {})
    has_password = bool(agent.get("password"))
    
    return {"hasPassword": has_password, "email": email_lower}

@router.post("/login")
def login(req: LoginRequest):
    email_lower = req.email.lower()
    if not email_lower.endswith("@fristinetech.com"):
        raise HTTPException(status_code=403, detail="Access restricted to @fristinetech.com accounts")
        
    agents = store.read("agents.json", {})
    agent = agents.get(email_lower)
    
    if not agent or not agent.get("password"):
        raise HTTPException(status_code=401, detail={"error": "NO_PASSWORD", "message": "No password set for this account — please set one."})
        
    if agent.get("password") != req.password:
        raise HTTPException(status_code=401, detail={"error": "WRONG_PASSWORD", "message": "Incorrect password."})
        
    return {
        "success": True, 
        "email": email_lower, 
        "name": agent.get("name") or email_lower.split("@")[0]
    }

@router.post("/set-password")
def set_password(req: PassRequest):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    email_lower = req.email.lower()
    if not email_lower.endswith("@fristinetech.com"):
        raise HTTPException(status_code=403, detail="Access restricted to @fristinetech.com accounts")
        
    agents = store.read("agents.json", {})
    agent = agents.get(email_lower, {})
    
    agent["password"] = req.password
    agent["email"] = email_lower
    agent["updatedAt"] = datetime.utcnow().isoformat()
    
    agents[email_lower] = agent
    store.write("agents.json", agents)
    
    return {"success": True}
