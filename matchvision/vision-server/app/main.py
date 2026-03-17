"""MatchVision server — receives frames, runs YOLO, streams annotated video + stats."""

from __future__ import annotations

import asyncio
import io
import json
import logging
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from app.config import MJPEG_QUALITY
from app.detector import MatchDetector
from app.annotator import annotate_frame

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state
detector: MatchDetector | None = None
latest_annotated_frame: bytes | None = None
latest_stats: dict = {}
frame_event = asyncio.Event()
stats_clients: list[asyncio.Queue] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector
    logger.info("Initializing MatchDetector...")
    detector = MatchDetector()
    # Warm up the model with a dummy frame
    dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    detector.process_frame(dummy)
    logger.info("MatchDetector ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(title="MatchVision", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": detector is not None}


@app.post("/frame")
async def receive_frame(request):
    """Receive a raw JPEG frame, run detection, update annotated output."""
    global latest_annotated_frame, latest_stats

    body = await request.body()
    if not body:
        return JSONResponse({"error": "empty frame"}, status_code=400)

    # Decode JPEG
    arr = np.frombuffer(body, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return JSONResponse({"error": "invalid frame"}, status_code=400)

    # Run detection
    result = detector.process_frame(frame)

    # Annotate
    annotated = annotate_frame(
        frame, result, detector.ball_trail, detector.possession
    )

    # Encode to JPEG
    _, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, MJPEG_QUALITY])
    latest_annotated_frame = jpeg.tobytes()
    frame_event.set()
    frame_event.clear()

    # Build stats payload
    home_pct, away_pct = detector.possession
    latest_stats = {
        "frame": result.frame_number,
        "fps": round(result.fps, 1),
        "inference_ms": round(result.inference_ms, 1),
        "home_count": result.home_count,
        "away_count": result.away_count,
        "ball_detected": result.ball_detected,
        "ball_position": result.ball_position,
        "possession_home": home_pct,
        "possession_away": away_pct,
        "detections": [
            {
                "track_id": d.track_id,
                "team": d.team,
                "label": d.label,
                "center": d.center,
                "confidence": round(d.confidence, 2),
            }
            for d in result.detections
        ],
        "timestamp": time.time(),
    }

    # Push to stats subscribers
    for q in stats_clients:
        try:
            q.put_nowait(latest_stats)
        except asyncio.QueueFull:
            pass

    return JSONResponse({
        "frame": result.frame_number,
        "detections": len(result.detections),
        "inference_ms": round(result.inference_ms, 1),
    })


@app.get("/stream/mjpeg")
async def mjpeg_stream():
    """MJPEG stream of annotated frames for <img> tag consumption."""
    async def generate():
        while True:
            if latest_annotated_frame:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + latest_annotated_frame
                    + b"\r\n"
                )
            await asyncio.sleep(0.03)  # ~30fps cap

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.websocket("/ws/stats")
async def stats_websocket(ws: WebSocket):
    """WebSocket stream of detection stats for the dashboard."""
    await ws.accept()
    queue: asyncio.Queue = asyncio.Queue(maxsize=30)
    stats_clients.append(queue)
    try:
        while True:
            stats = await queue.get()
            await ws.send_json(stats)
    except WebSocketDisconnect:
        pass
    finally:
        stats_clients.remove(queue)


@app.get("/stats")
async def get_stats():
    """Get latest stats snapshot."""
    return JSONResponse(latest_stats if latest_stats else {"status": "no frames yet"})


@app.post("/reset")
async def reset_stats():
    """Reset accumulated stats."""
    if detector:
        detector.reset_stats()
    return {"status": "reset"}
