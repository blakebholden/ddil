from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from app.routers import race, search, chat, images, sensors, vineyard, finance, jina, ccs
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
app.include_router(vineyard.router, prefix="/api/vineyard", tags=["vineyard"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
app.include_router(jina.router, prefix="/api/jina", tags=["jina"])
app.include_router(ccs.router, prefix="/api/ccs", tags=["ccs"])


@app.get("/tiles/{z}/{x}/{y}.png")
async def serve_tile(z: int, x: int, y: int):
    tile_path = Path(f"/tiles/{z}/{x}/{y}.png")
    if tile_path.exists():
        return FileResponse(tile_path, media_type="image/png")
    # Return transparent 1x1 PNG for missing tiles
    return Response(
        content=b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82',
        media_type="image/png",
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "vineyard-intelligence"}
