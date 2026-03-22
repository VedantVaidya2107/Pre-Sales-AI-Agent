import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

from routers import auth, clients, tracking, proposals, email, gemini

load_dotenv()

app = FastAPI(title="Fristine Presales Backend")

# CORS Middleware
origins = [
    os.environ.get("FRONTEND_URL", "http://localhost:5173"),
    "http://localhost:4173",
    "http://localhost:5174",
    "http://localhost:5175",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allowing all for dev. In prod restrict to origins list
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    import datetime
    return {"status": "ok", "ts": datetime.datetime.utcnow().isoformat()}

app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(tracking.router)
app.include_router(proposals.router)
app.include_router(email.router)
app.include_router(gemini.router)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
