from fastapi import APIRouter, UploadFile, File

router = APIRouter()


@router.post("/search")
async def image_search(image: UploadFile = File(...)):
    # TODO: Embed image via CLIP, then kNN search vineyard-imagery index
    # For now return mock results
    return {
        "classification": "Black Rot",
        "confidence": 0.942,
        "similarCount": 847,
        "affectedBlocks": ["B3", "B7", "C2"],
        "recommendation": (
            "Apply mancozeb fungicide within 48 hours. "
            "Remove infected leaves and fruit mummies. "
            "Increase canopy airflow by shoot positioning."
        ),
        "similarImages": [
            {"path": "/images/disease/blackrot_001.jpg", "score": 0.96},
            {"path": "/images/disease/blackrot_002.jpg", "score": 0.94},
            {"path": "/images/disease/blackrot_003.jpg", "score": 0.91},
            {"path": "/images/disease/blackrot_004.jpg", "score": 0.89},
            {"path": "/images/disease/blackrot_005.jpg", "score": 0.87},
        ],
    }
