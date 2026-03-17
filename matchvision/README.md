# MatchVision — Real-Time AI Match Analysis

Live video analysis using YOLO object detection on NVIDIA Blackwell GPU.
Captures screen content (browser playing a match/Netflix), runs inference
on the DGX Spark, and streams annotated video + stats back in real time.

## Architecture

```
Framework Desktop              DGX Spark (Blackwell GPU)
┌────────────────────┐        ┌──────────────────────────┐
│ capture.py         │ JPEG   │ vision-server (Docker)   │
│ Screen grab → send │───────>│ YOLOv8x + ByteTrack     │
│                    │        │ Annotate + MJPEG stream  │
│ dashboard (React)  │<───────│ + WebSocket stats        │
│ http://localhost:3100       │ http://spark:8010        │
└────────────────────┘        └──────────────────────────┘
```

## Quick Start — Local Test (no Spark needed)

```bash
# Install capture deps on Mac
cd capture
pip3 install ultralytics opencv-python mss numpy

# Run local mode (uses CPU YOLO nano model)
python3 capture_local.py

# Open http://localhost:8010 in browser to see annotated feed
# Play any video in another window — it captures your screen
```

## Production — Framework + DGX Spark

### 1. Deploy vision server on Spark

```bash
# On the Spark (or from Framework via SSH)
cd matchvision
docker compose up -d

# Wait for model download on first run (~300MB for YOLOv8x)
docker logs -f vision-server
```

### 2. Start capture on Framework

```bash
cd capture
pip3 install -r requirements.txt

# Capture full screen at 8fps, send to Spark
python3 capture.py --server http://192.168.1.20:8010 --fps 8

# Or capture a specific region
python3 capture.py --region 100,100,1920,1080 --fps 10
```

### 3. Open dashboard on Framework

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:3100
```

## What You See

- **Left panel**: Live annotated video with bounding boxes (red=home, white=away, yellow=ball)
- **Right panel**: Real-time stats — possession bar, player counts, ball tracking, mini pitch map

## Endpoints (vision-server, port 8010)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status |
| `/frame` | POST | Send JPEG frame for processing |
| `/stream/mjpeg` | GET | Annotated video stream |
| `/ws/stats` | WS | Live detection stats |
| `/stats` | GET | Latest stats snapshot |
| `/reset` | POST | Reset accumulated stats |

## Performance

| Hardware | Model | FPS | Inference |
|----------|-------|-----|-----------|
| DGX Spark (Blackwell) | YOLOv8x | ~30 | ~30ms |
| Mac CPU | YOLOv8n | ~5 | ~200ms |
