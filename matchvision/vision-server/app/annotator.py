"""Draw annotations on video frames — bounding boxes, labels, ball trail, stats overlay."""

from __future__ import annotations

import cv2
import numpy as np

from app.detector import Detection, FrameResult


TEAM_COLORS_BGR = {
    "home": (40, 40, 220),      # Red (Arsenal)
    "away": (240, 240, 240),    # White
    "ball": (0, 255, 255),      # Yellow
    "referee": (128, 255, 0),   # Green
    "unknown": (128, 128, 128), # Gray
}

FONT = cv2.FONT_HERSHEY_SIMPLEX


def annotate_frame(
    frame: np.ndarray,
    result: FrameResult,
    ball_trail: list[tuple[int, int]],
    possession: tuple[float, float],
) -> np.ndarray:
    """Draw all annotations on the frame and return it."""
    annotated = frame.copy()

    # Draw ball trail
    _draw_ball_trail(annotated, ball_trail)

    # Draw detections
    for det in result.detections:
        _draw_detection(annotated, det)

    # Draw stats overlay
    _draw_stats_overlay(annotated, result, possession)

    return annotated


def _draw_detection(frame: np.ndarray, det: Detection):
    """Draw bounding box and label for a single detection."""
    x1, y1, x2, y2 = det.bbox
    color = TEAM_COLORS_BGR.get(det.team, (128, 128, 128))

    if det.label == "ball":
        # Draw circle for ball
        cx, cy = det.center
        radius = max((x2 - x1) // 2, 8)
        cv2.circle(frame, (cx, cy), radius, color, 2)
        cv2.circle(frame, (cx, cy), 3, color, -1)
    else:
        # Bounding box with rounded appearance
        thickness = 2
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        # Label background
        label = f"#{det.track_id} {det.team}"
        (tw, th), _ = cv2.getTextSize(label, FONT, 0.4, 1)
        cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4), FONT, 0.4, (0, 0, 0), 1, cv2.LINE_AA)

        # Center dot
        cv2.circle(frame, det.center, 3, color, -1)


def _draw_ball_trail(frame: np.ndarray, trail: list[tuple[int, int]]):
    """Draw fading ball trail."""
    if len(trail) < 2:
        return
    for i in range(1, len(trail)):
        alpha = i / len(trail)
        color = (0, int(255 * alpha), int(255 * alpha))
        thickness = max(1, int(alpha * 3))
        cv2.line(frame, trail[i - 1], trail[i], color, thickness, cv2.LINE_AA)


def _draw_stats_overlay(
    frame: np.ndarray,
    result: FrameResult,
    possession: tuple[float, float],
):
    """Draw semi-transparent stats panel in top-left corner."""
    h, w = frame.shape[:2]

    # Background panel
    panel_w, panel_h = 320, 140
    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (10 + panel_w, 10 + panel_h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

    y = 32
    # Title
    cv2.putText(frame, "MATCH VISION", (20, y), FONT, 0.6, (0, 255, 200), 2, cv2.LINE_AA)
    y += 28

    # FPS / Inference
    cv2.putText(
        frame,
        f"FPS: {result.fps:.1f}  |  Inference: {result.inference_ms:.0f}ms",
        (20, y), FONT, 0.4, (180, 180, 180), 1, cv2.LINE_AA,
    )
    y += 22

    # Player counts
    cv2.putText(
        frame,
        f"Home: {result.home_count}  Away: {result.away_count}  Ball: {'YES' if result.ball_detected else 'NO'}",
        (20, y), FONT, 0.4, (180, 180, 180), 1, cv2.LINE_AA,
    )
    y += 22

    # Possession bar
    home_pct, away_pct = possession
    bar_x, bar_y, bar_w, bar_h = 20, y, 290, 16
    home_w = int(bar_w * home_pct / 100)

    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + home_w, bar_y + bar_h), (40, 40, 220), -1)
    cv2.rectangle(frame, (bar_x + home_w, bar_y), (bar_x + bar_w, bar_y + bar_h), (240, 240, 240), -1)
    cv2.putText(frame, f"{home_pct:.0f}%", (bar_x + 4, bar_y + 12), FONT, 0.35, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(frame, f"{away_pct:.0f}%", (bar_x + bar_w - 35, bar_y + 12), FONT, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
    y += 24

    # Frame counter
    cv2.putText(
        frame,
        f"Frame: {result.frame_number}",
        (20, y), FONT, 0.35, (120, 120, 120), 1, cv2.LINE_AA,
    )
