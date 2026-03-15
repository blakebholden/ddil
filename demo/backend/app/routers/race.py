import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.schemas import RaceStartRequest
from app.services.indexer import run_race, get_race_metrics, reset_race
from app.config import settings

router = APIRouter()


@router.post("/start")
async def start_race(req: RaceStartRequest | None = None):
    req = req or RaceStartRequest()
    asyncio.create_task(run_race(req.index_name, req.data_file))
    return {"status": "started", "index": req.index_name}


@router.websocket("/status")
async def race_status_ws(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            metrics = get_race_metrics()
            await ws.send_json(metrics.to_dict())
            if metrics.status == "complete":
                await asyncio.sleep(1)
                await ws.send_json(metrics.to_dict())
                break
            await asyncio.sleep(settings.RACE_METRICS_INTERVAL_MS / 1000)
    except WebSocketDisconnect:
        pass


@router.post("/reset")
async def reset():
    await reset_race()
    return {"status": "reset"}
