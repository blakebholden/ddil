"""YOLO-based object detection and tracking for broadcast video."""

from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field

import cv2
import numpy as np
from ultralytics import YOLO

from app.config import (
    YOLO_MODEL,
    CONFIDENCE_THRESHOLD,
    DEVICE,
    PERSON_CLASS,
    BALL_CLASS,
    ARSENAL_RED_LOWER,
    ARSENAL_RED_UPPER,
    ARSENAL_RED_LOWER2,
    ARSENAL_RED_UPPER2,
)

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    track_id: int
    class_id: int
    label: str  # "player", "ball", "referee"
    team: str  # "home", "away", "ball", "referee", "unknown"
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    center: tuple[int, int]
    color_rgb: tuple[int, int, int] = (255, 255, 255)


@dataclass
class FrameResult:
    detections: list[Detection] = field(default_factory=list)
    fps: float = 0.0
    inference_ms: float = 0.0
    frame_number: int = 0
    timestamp: float = 0.0
    home_count: int = 0
    away_count: int = 0
    ball_detected: bool = False
    ball_position: tuple[int, int] | None = None


class MatchDetector:
    """Real-time match analysis using YOLO + ByteTrack."""

    def __init__(self):
        logger.info("Loading YOLO model: %s on device: %s", YOLO_MODEL, DEVICE)
        self.model = YOLO(YOLO_MODEL)
        self.frame_count = 0
        self.start_time = time.time()

        # Possession tracking
        self.home_possession_frames = 0
        self.away_possession_frames = 0
        self.total_frames = 0

        # Ball trail
        self.ball_trail: list[tuple[int, int]] = []
        self.max_trail = 60

        # Player heatmap accumulators
        self.home_positions: list[tuple[int, int]] = []
        self.away_positions: list[tuple[int, int]] = []

    def process_frame(self, frame: np.ndarray) -> FrameResult:
        """Run detection + tracking on a single frame."""
        t0 = time.time()
        self.frame_count += 1

        # Run YOLO with built-in ByteTrack tracker
        results = self.model.track(
            frame,
            persist=True,
            conf=CONFIDENCE_THRESHOLD,
            classes=[PERSON_CLASS, BALL_CLASS],
            device=DEVICE,
            verbose=False,
            tracker="bytetrack.yaml",
        )

        inference_ms = (time.time() - t0) * 1000
        elapsed = time.time() - self.start_time
        fps = self.frame_count / elapsed if elapsed > 0 else 0

        detections: list[Detection] = []
        ball_pos = None

        if results and results[0].boxes is not None:
            boxes = results[0].boxes
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                conf = float(boxes.conf[i].item())
                x1, y1, x2, y2 = [int(v) for v in boxes.xyxy[i].tolist()]
                track_id = int(boxes.id[i].item()) if boxes.id is not None else i
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

                if cls_id == BALL_CLASS:
                    det = Detection(
                        track_id=track_id,
                        class_id=cls_id,
                        label="ball",
                        team="ball",
                        bbox=(x1, y1, x2, y2),
                        confidence=conf,
                        center=(cx, cy),
                        color_rgb=(255, 255, 0),
                    )
                    ball_pos = (cx, cy)
                    detections.append(det)
                elif cls_id == PERSON_CLASS:
                    team, color = self._classify_team(frame, x1, y1, x2, y2)
                    det = Detection(
                        track_id=track_id,
                        class_id=cls_id,
                        label="player",
                        team=team,
                        bbox=(x1, y1, x2, y2),
                        confidence=conf,
                        center=(cx, cy),
                        color_rgb=color,
                    )
                    detections.append(det)

                    # Accumulate positions for heatmaps
                    if team == "home":
                        self.home_positions.append((cx, cy))
                    elif team == "away":
                        self.away_positions.append((cx, cy))

        # Ball trail
        if ball_pos:
            self.ball_trail.append(ball_pos)
            if len(self.ball_trail) > self.max_trail:
                self.ball_trail.pop(0)

        # Possession estimation (nearest player to ball)
        home_count = sum(1 for d in detections if d.team == "home")
        away_count = sum(1 for d in detections if d.team == "away")

        if ball_pos and detections:
            self._update_possession(ball_pos, detections)

        return FrameResult(
            detections=detections,
            fps=fps,
            inference_ms=inference_ms,
            frame_number=self.frame_count,
            timestamp=time.time(),
            home_count=home_count,
            away_count=away_count,
            ball_detected=ball_pos is not None,
            ball_position=ball_pos,
        )

    def _classify_team(
        self, frame: np.ndarray, x1: int, y1: int, x2: int, y2: int
    ) -> tuple[str, tuple[int, int, int]]:
        """Classify player team by jersey color (HSV analysis of upper body)."""
        # Focus on upper 40% of bounding box (jersey, not shorts/legs)
        h = y2 - y1
        jersey_region = frame[y1 : y1 + int(h * 0.4), x1:x2]
        if jersey_region.size == 0:
            return "unknown", (128, 128, 128)

        hsv = cv2.cvtColor(jersey_region, cv2.COLOR_BGR2HSV)

        # Check for red (Arsenal home)
        mask1 = cv2.inRange(hsv, np.array(ARSENAL_RED_LOWER), np.array(ARSENAL_RED_UPPER))
        mask2 = cv2.inRange(hsv, np.array(ARSENAL_RED_LOWER2), np.array(ARSENAL_RED_UPPER2))
        red_ratio = (cv2.countNonZero(mask1) + cv2.countNonZero(mask2)) / max(hsv.shape[0] * hsv.shape[1], 1)

        # Check for white (common away kits, also referee)
        white_lower = np.array([0, 0, 180])
        white_upper = np.array([180, 40, 255])
        white_mask = cv2.inRange(hsv, white_lower, white_upper)
        white_ratio = cv2.countNonZero(white_mask) / max(hsv.shape[0] * hsv.shape[1], 1)

        # Check for green (pitch color — likely referee or GK)
        green_lower = np.array([35, 40, 40])
        green_upper = np.array([85, 255, 255])
        green_mask = cv2.inRange(hsv, green_lower, green_upper)
        green_ratio = cv2.countNonZero(green_mask) / max(hsv.shape[0] * hsv.shape[1], 1)

        # Get dominant color for the annotation
        avg_color = cv2.mean(jersey_region)[:3]
        dom_rgb = (int(avg_color[2]), int(avg_color[1]), int(avg_color[0]))

        if green_ratio > 0.4:
            return "referee", (0, 255, 128)
        elif red_ratio > 0.15:
            return "home", (220, 40, 40)
        elif white_ratio > 0.3:
            return "away", (240, 240, 240)
        else:
            return "away", dom_rgb

    def _update_possession(self, ball_pos: tuple[int, int], detections: list[Detection]):
        """Estimate possession based on nearest player to ball."""
        self.total_frames += 1
        min_dist = float("inf")
        nearest_team = None

        for d in detections:
            if d.team in ("home", "away"):
                dist = ((d.center[0] - ball_pos[0]) ** 2 + (d.center[1] - ball_pos[1]) ** 2) ** 0.5
                if dist < min_dist:
                    min_dist = dist
                    nearest_team = d.team

        if nearest_team == "home":
            self.home_possession_frames += 1
        elif nearest_team == "away":
            self.away_possession_frames += 1

    @property
    def possession(self) -> tuple[float, float]:
        """Return (home_pct, away_pct)."""
        total = self.home_possession_frames + self.away_possession_frames
        if total == 0:
            return 50.0, 50.0
        home_pct = round(self.home_possession_frames / total * 100, 1)
        return home_pct, round(100 - home_pct, 1)

    def reset_stats(self):
        """Reset accumulated stats."""
        self.home_possession_frames = 0
        self.away_possession_frames = 0
        self.total_frames = 0
        self.ball_trail.clear()
        self.home_positions.clear()
        self.away_positions.clear()
        self.frame_count = 0
        self.start_time = time.time()
