from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from utils import store

router = APIRouter(prefix="/api/proposals", tags=["Proposals"])

class ProposalData(BaseModel):
    proposal_html: str
    title: Optional[str] = None
    version: Optional[int] = None

@router.get("/{client_id}")
def get_proposal(client_id: str):
    proposals = store.read("proposals.json", {})
    p = proposals.get(client_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    if "versions" not in p:
        migrated = {
            "client_id": p.get("client_id", client_id),
            "versions": [{
                "version": 1,
                "proposal_html": p.get("proposal_html", ""),
                "title": p.get("title", ""),
                "savedAt": p.get("savedAt", datetime.utcnow().isoformat())
            }]
        }
        proposals[client_id] = migrated
        store.write("proposals.json", proposals)
        return migrated
        
    return p

@router.post("/{client_id}")
def create_proposal(client_id: str, req: ProposalData):
    proposals = store.read("proposals.json", {})
    
    if client_id not in proposals:
        proposals[client_id] = {"client_id": client_id, "versions": []}
    elif "versions" not in proposals[client_id]:
        old_p = proposals[client_id]
        proposals[client_id] = {
            "client_id": client_id,
            "versions": [{
                "version": 1,
                "proposal_html": old_p.get("proposal_html", ""),
                "title": old_p.get("title", ""),
                "savedAt": old_p.get("savedAt", datetime.utcnow().isoformat())
            }]
        }
    
    new_version_num = len(proposals[client_id]["versions"]) + 1
    
    proposals[client_id]["versions"].append({
        "version": new_version_num,
        "proposal_html": req.proposal_html,
        "title": req.title or f"Zoho Proposal — {client_id} (v{new_version_num})",
        "savedAt": datetime.utcnow().isoformat()
    })
    
    store.write("proposals.json", proposals)
    return {"success": True, "version": new_version_num}

@router.put("/{client_id}")
def update_proposal(client_id: str, req: ProposalData):
    proposals = store.read("proposals.json", {})
    if client_id not in proposals:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    p = proposals[client_id]
    if "versions" not in p:
        p = {
            "client_id": client_id,
            "versions": [{
                "version": 1,
                "proposal_html": p.get("proposal_html", ""),
                "title": p.get("title", ""),
                "savedAt": p.get("savedAt", datetime.utcnow().isoformat())
            }]
        }
        proposals[client_id] = p
        
    if len(p["versions"]) == 0:
        raise HTTPException(status_code=404, detail="No versions found to update")
        
    if req.version is not None:
        target = next((v for v in p["versions"] if v["version"] == req.version), None)
        if not target:
            raise HTTPException(status_code=404, detail="Version not found")
    else:
        target = p["versions"][-1]
        
    target["proposal_html"] = req.proposal_html
    target["updatedAt"] = datetime.utcnow().isoformat()
    
    store.write("proposals.json", proposals)
    return {"success": True}
