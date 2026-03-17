#!/usr/bin/env python3
"""
Local test mode — runs YOLO detection directly on the Framework Mac.
No DGX Spark needed. Lower performance but good for testing the pipeline.

Usage:
    pip install ultralytics opencv-python mss numpy
    python capture_local.py
    # Then open http://localhost:8010/stream/mjpeg in a browser
"""

import argparse
import time
import threading

import cv2
import mss
import numpy as np
from ultralytics import YOLO


# Simple MJPEG server for local testing
from http.server import HTTPServer, BaseHTTPRequestHandler


latest_frame: bytes = b""
lock = threading.Lock()


class MJPEGHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/stream/mjpeg":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()
            try:
                while True:
                    with lock:
                        frame_data = latest_frame
                    if frame_data:
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n\r\n")
                        self.wfile.write(frame_data)
                        self.wfile.write(b"\r\n")
                    time.sleep(0.05)
            except (BrokenPipeError, ConnectionResetError):
                pass
        else:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"""<html><body style="background:#000;margin:0">
                <img src="/stream/mjpeg" style="width:100%;height:100vh;object-fit:contain"/>
                </body></html>""")

    def log_message(self, *args):
        pass  # Suppress request logs


def run_server(port=8010):
    server = HTTPServer(("0.0.0.0", port), MJPEGHandler)
    print(f"  MJPEG server at http://localhost:{port}")
    print(f"  Open in browser to view annotated feed\n")
    server.serve_forever()


def main():
    global latest_frame

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="yolov8n.pt", help="YOLO model (default: nano for CPU)")
    parser.add_argument("--fps", type=int, default=5, help="Target FPS")
    parser.add_argument("--monitor", type=int, default=0, help="Monitor index")
    parser.add_argument("--port", type=int, default=8010, help="MJPEG server port")
    parser.add_argument("--resize", type=int, default=960, help="Resize width")
    args = parser.parse_args()

    print("MatchVision Local Test Mode")
    print(f"  Model: {args.model}")
    print(f"  FPS: {args.fps}")

    # Start MJPEG server in background
    server_thread = threading.Thread(target=run_server, args=(args.port,), daemon=True)
    server_thread.start()

    # Load YOLO
    print("  Loading YOLO model...")
    model = YOLO(args.model)
    print("  Model loaded.\n")

    frame_interval = 1.0 / args.fps
    frame_count = 0

    with mss.mss() as sct:
        monitor = sct.monitors[args.monitor]
        print(f"  Capturing: {monitor}")
        print(f"  Press Ctrl+C to stop\n")

        try:
            while True:
                t0 = time.time()

                screenshot = sct.grab(monitor)
                frame = np.array(screenshot)
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

                # Resize
                h, w = frame.shape[:2]
                scale = args.resize / w
                if scale < 1.0:
                    frame = cv2.resize(frame, (args.resize, int(h * scale)))

                # Run YOLO
                results = model.track(
                    frame, persist=True, conf=0.3,
                    classes=[0, 32],  # person, sports ball
                    verbose=False,
                )

                # Draw annotations
                annotated = results[0].plot() if results else frame

                # Add FPS overlay
                fps = frame_count / max(time.time() - t0, 0.001)
                cv2.putText(
                    annotated, f"LOCAL TEST | {fps:.1f} fps",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 200), 2,
                )

                # Encode and update
                _, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
                with lock:
                    latest_frame = jpeg.tobytes()

                frame_count += 1
                if frame_count % 10 == 0:
                    elapsed = time.time() - t0
                    print(f"  Frame {frame_count:>5d} | {1/max(elapsed,0.001):.1f} fps", flush=True)

                sleep_time = frame_interval - (time.time() - t0)
                if sleep_time > 0:
                    time.sleep(sleep_time)

        except KeyboardInterrupt:
            print(f"\n  Done. Processed {frame_count} frames.")


if __name__ == "__main__":
    main()
