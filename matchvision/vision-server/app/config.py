"""MatchVision configuration."""

import os

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8x.pt")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.3"))
DEVICE = os.getenv("DEVICE", "0")  # GPU device index

# Detection classes of interest (COCO)
# 0=person, 32=sports ball
PERSON_CLASS = 0
BALL_CLASS = 32

# Team color detection (HSV ranges for Arsenal red)
ARSENAL_RED_LOWER = (0, 120, 80)
ARSENAL_RED_UPPER = (10, 255, 255)
ARSENAL_RED_LOWER2 = (170, 120, 80)
ARSENAL_RED_UPPER2 = (180, 255, 255)

# Frame processing
MAX_FPS = 15
MJPEG_QUALITY = 80

# Elasticsearch index
ES_INDEX = "matchvision-events"
