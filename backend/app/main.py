from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, sessions, cards, imports, stats

app = FastAPI(title="VocabFlash API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(cards.router, tags=["cards"])
app.include_router(imports.router, prefix="/sessions", tags=["imports"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
