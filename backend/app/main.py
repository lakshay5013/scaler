from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os

load_dotenv()

from app.database import connect_db, disconnect_db, seed_db
from app.routes import event_types, bookings, availability, apps


@asynccontextmanager
async def lifespan(application: FastAPI):
    await connect_db()
    await seed_db()
    yield
    await disconnect_db()


app = FastAPI(title="Cal.com Clone API", lifespan=lifespan)

frontend_origins = {
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
}

raw_frontend_origins = os.getenv("FRONTEND_ORIGIN", "")
for origin in raw_frontend_origins.split(","):
    cleaned = origin.strip()
    if cleaned:
        frontend_origins.add(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(frontend_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(event_types.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(availability.router, prefix="/api")
app.include_router(apps.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
