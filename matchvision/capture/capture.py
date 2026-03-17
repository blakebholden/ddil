#!/usr/bin/env python3
"""
Screen capture → frame sender for MatchVision.

Captures a region of the screen (e.g., browser playing Netflix/match)
and sends JPEG frames to the vision server on the DGX Spark.

Usage:
    python capture.py                          # Full screen
    python capture.py --fps 10                 # 10 fps
    python capture.py --region 100,100,1280,720  # Specific region
    python capture.py --monitor 2              # Second monitor
"""

import argparse
import time
import sys

import cv2
import httpx
import mss
import numpy as np


def parse_args():
    p = argparse.ArgumentParser(description="MatchVision screen capture")
    p.add_argument("--server", default="http://192.168.1.20:8010",
                    help="Vision server URL (default: DGX Spark)")
    p.add_argument("--fps", type=int, default=8,
                    help="Target frames per second (default: 8)")
    p.add_argument("--monitor", type=int, default=0,
                    help="Monitor index (0=all, 1=primary, 2=secondary)")
    p.add_argument("--region", type=str, default=None,
                    help="Capture region: x,y,width,height")
    p.add_argument("--resize", type=int, default=1280,
                    help="Resize width before sending (default: 1280)")
    p.add_argument("--quality", type=int, default=80,
                    help="JPEG quality 1-100 (default: 80)")
    p.add_argument("--show", action="store_true",
                    help="Show local preview window")
    return p.parse_args()


def main():
    args = parse_args()
    frame_interval = 1.0 / args.fps
    frame_count = 0
    errors = 0

    print(f"MatchVision Capture")
    print(f"  Server: {args.server}")
    print(f"  FPS: {args.fps}")
    print(f"  Resize: {args.resize}px wide")
    print(f"  Press Ctrl+C to stop\n")

    client = httpx.Client(timeout=5.0)

    # Test connection
    try:
        r = client.get(f"{args.server}/health")
        print(f"  Server status: {r.json()}")
    except Exception as e:
        print(f"  WARNING: Cannot reach server: {e}")
        print(f"  Will retry on each frame...\n")

    with mss.mss() as sct:
        # Determine capture region
        if args.region:
            x, y, w, h = [int(v) for v in args.region.split(",")]
            monitor = {"left": x, "top": y, "width": w, "height": h}
        elif args.monitor > 0 and args.monitor < len(sct.monitors):
            monitor = sct.monitors[args.monitor]
        else:
            monitor = sct.monitors[0]  # All monitors combined

        print(f"  Capture region: {monitor}")
        print(f"  Streaming...\n")

        try:
            while True:
                t0 = time.time()

                # Capture screen
                screenshot = sct.grab(monitor)
                frame = np.array(screenshot)

                # Convert BGRA → BGR
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

                # Resize
                if args.resize:
                    h, w = frame.shape[:2]
                    scale = args.resize / w
                    if scale < 1.0:
                        new_h = int(h * scale)
                        frame = cv2.resize(frame, (args.resize, new_h))

                # Encode to JPEG
                _, jpeg = cv2.imencode(
                    ".jpg", frame,
                    [cv2.IMWRITE_JPEG_QUALITY, args.quality]
                )
                jpeg_bytes = jpeg.tobytes()

                # Send to vision server
                try:
                    resp = client.post(
                        f"{args.server}/frame",
                        content=jpeg_bytes,
                        headers={"Content-Type": "image/jpeg"},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        frame_count += 1
                        if frame_count % 10 == 0:
                            print(
                                f"  Frame {data['frame']:>5d} | "
                                f"{data['detections']:>2d} detections | "
                                f"{data['inference_ms']:>5.1f}ms inference | "
                                f"{len(jpeg_bytes)/1024:>5.1f}KB",
                                flush=True,
                            )
                        errors = 0
                    else:
                        errors += 1
                except httpx.RequestError as e:
                    errors += 1
                    if errors <= 3 or errors % 30 == 0:
                        print(f"  Send error ({errors}): {e}", flush=True)

                # Local preview
                if args.show:
                    cv2.imshow("MatchVision Capture", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                # Frame rate limiting
                elapsed = time.time() - t0
                sleep_time = frame_interval - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

        except KeyboardInterrupt:
            print(f"\n  Stopped. Sent {frame_count} frames.")

    if args.show:
        cv2.destroyAllWindows()
    client.close()


if __name__ == "__main__":
    main()
