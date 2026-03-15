import asyncio
import random
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Current sensor state (updated by Modbus reader or mock)
_current_reading = {
    "moisture": 34.2,
    "temp6": 18.4,
    "temp12": 16.1,
    "temp24": 14.8,
    "ec": 0.42,
    "nitrogen": 42.0,
    "phosphorus": 28.0,
    "potassium": 186.0,
    "ph": 6.2,
    "timestamp": time.time(),
}


def _mock_update():
    """Simulate sensor drift for development."""
    _current_reading["moisture"] += (random.random() - 0.5) * 0.3
    _current_reading["temp6"] += (random.random() - 0.5) * 0.1
    _current_reading["temp12"] += (random.random() - 0.5) * 0.05
    _current_reading["temp24"] += (random.random() - 0.5) * 0.03
    _current_reading["ec"] += (random.random() - 0.5) * 0.01
    _current_reading["nitrogen"] += (random.random() - 0.5) * 0.5
    _current_reading["phosphorus"] += (random.random() - 0.5) * 0.3
    _current_reading["potassium"] += (random.random() - 0.5) * 1.0
    _current_reading["ph"] += (random.random() - 0.5) * 0.02
    _current_reading["timestamp"] = time.time()


@router.get("/latest")
async def latest_reading():
    _mock_update()
    return _current_reading


@router.websocket("/stream")
async def sensor_stream(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            _mock_update()
            await ws.send_json(_current_reading)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
