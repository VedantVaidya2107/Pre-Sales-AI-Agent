from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from utils import store

router = APIRouter(prefix="/api/tracking", tags=["Tracking"])

class TrackingEvent(BaseModel):
    event: str
    note: Optional[str] = None

@router.get("/{client_id}")
def get_events(client_id: str):
    events = store.read("events.json", {})
    return events.get(client_id, [])

@router.post("/{client_id}")
def create_event(client_id: str, req: TrackingEvent):
    events = store.read("events.json", {})
    client_events = events.get(client_id, [])
    
    existing = next((e for e in client_events if e.get("event") == req.event), None)
    if not existing:
        client_events.append({
            "client_id": client_id,
            "event": req.event,
            "note": req.note,
            "timestamp": datetime.utcnow().isoformat()
        })
        events[client_id] = client_events
        store.write("events.json", events)
        
    return {"success": True, "events": events.get(client_id, [])}

@router.delete("/{client_id}")
def delete_events(client_id: str):
    events = store.read("events.json", {})
    if client_id in events:
        del events[client_id]
        store.write("events.json", events)
    return {"success": True}
