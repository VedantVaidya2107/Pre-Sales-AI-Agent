from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from utils import store

router = APIRouter(prefix="/api/clients", tags=["Clients"])

class ClientCreate(BaseModel):
    company: str
    email: str
    industry: Optional[str] = ""
    notes: Optional[str] = ""
    size: Optional[str] = ""

def generate_client_id(clients_list):
    comps = [c.get("client_id", "") for c in clients_list if isinstance(c.get("client_id"), str)]
    valid_ids = [int(i.replace("FRIST", "")) for i in comps if i.startswith("FRIST") and i.replace("FRIST", "").isdigit()]
    next_id = max(valid_ids) + 1 if valid_ids else 1
    return f"FRIST{next_id:03d}"

@router.get("/")
def get_clients():
    return store.read("clients.json", [])

@router.get("/next-id")
def get_next_id():
    clients = store.read("clients.json", [])
    return {"next_id": generate_client_id(clients)}

@router.get("/{client_id}")
def get_client(client_id: str):
    clients = store.read("clients.json", [])
    client = next((c for c in clients if c.get("client_id", "").lower() == client_id.lower()), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.post("/")
def create_client(req: ClientCreate):
    clients = store.read("clients.json", [])
    client_id = generate_client_id(clients)
    new_client = {
        "client_id": client_id,
        "company": req.company.strip(),
        "industry": req.industry.strip() if req.industry else "",
        "email": req.email.strip(),
        "notes": req.notes.strip() if req.notes else "",
        "size": req.size.strip() if req.size else "",
        "createdAt": datetime.utcnow().isoformat()
    }
    clients.append(new_client)
    store.write("clients.json", clients)
    return new_client

@router.put("/{client_id}")
def update_client(client_id: str, updates: dict):
    clients = store.read("clients.json", [])
    idx = next((i for i, c in enumerate(clients) if c.get("client_id") == client_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Client not found")
    
    clients[idx].update(updates)
    clients[idx]["client_id"] = client_id
    store.write("clients.json", clients)
    return clients[idx]

@router.delete("/{client_id}")
def delete_client(client_id: str):
    clients = store.read("clients.json", [])
    before = len(clients)
    clients = [c for c in clients if c.get("client_id") != client_id]
    if len(clients) == before:
        raise HTTPException(status_code=404, detail="Client not found")
    store.write("clients.json", clients)
    return {"success": True}
