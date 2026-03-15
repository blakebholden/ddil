from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import race, search, chat, images, sensors
from app.services.elasticsearch import close_clients


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_clients()


app = FastAPI(
    title="Vineyard Intelligence API",
    description="DDIL Demo Kit — GPU vs CPU indexing race + context engineering",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(race.router, prefix="/api/race", tags=["race"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(sensors.router, prefix="/api/sensors", tags=["sensors"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "vineyard-intelligence"}
