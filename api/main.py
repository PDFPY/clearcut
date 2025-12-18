from __future__ import annotations

import io, os, json
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

import numpy as np
from PIL import Image

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from rembg import remove

# SAM
import torch
from segment_anything import sam_model_registry, SamPredictor


MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "10485760"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000")
ALLOWED = {"image/png", "image/jpeg", "image/jpg", "image/webp"}

SAM_MODEL_TYPE = os.getenv("SAM_MODEL_TYPE", "vit_b")
SAM_CHECKPOINT = os.getenv("SAM_CHECKPOINT", "./models/sam_vit_b.pth")

app = FastAPI(title="ClearCut API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def read_limited(f: UploadFile) -> bytes:
    data = f.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")
    return data

@app.get("/health")
def health():
    return {"ok": True}

# -------------------------
# Rembg background removal
# -------------------------
@app.post("/remove_png")
def remove_png(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Unsupported file type.")
    raw = read_limited(file)
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image.")

    try:
        out = remove(
            img,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
        )
        if isinstance(out, Image.Image):
            out_img = out.convert("RGBA")
        else:
            out_img = Image.open(io.BytesIO(out)).convert("RGBA")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Removal failed: {type(e).__name__}")

    buf = io.BytesIO()
    out_img.save(buf, format="PNG", optimize=True)
    return Response(content=buf.getvalue(), media_type="image/png")


# -------------------------
# SAM (smart snap)
# -------------------------
_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_predictor: Optional[SamPredictor] = None

def get_predictor() -> SamPredictor:
    global _predictor
    if _predictor is not None:
        return _predictor

    if not os.path.exists(SAM_CHECKPOINT):
        raise RuntimeError(f"SAM checkpoint not found: {SAM_CHECKPOINT}")

    sam = sam_model_registry[SAM_MODEL_TYPE](checkpoint=SAM_CHECKPOINT)
    sam.to(device=_DEVICE)
    _predictor = SamPredictor(sam)
    print(f"[SAM] Loaded {SAM_MODEL_TYPE} on {_DEVICE} from {os.path.abspath(SAM_CHECKPOINT)}")
    return _predictor

@app.post("/sam_mask")
def sam_mask(
    file: UploadFile = File(...),
    req: str = Form(...),          # <-- IMPORTANT: req comes from multipart/form-data
):
    """
    req JSON format:
    {
      "points": [[x,y], [x,y], ...],
      "labels": [1,0,1,...],
      "box": [x1,y1,x2,y2] (optional)
    }
    labels: 1=keep, 0=remove
    """
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    try:
        payload = json.loads(req)
    except Exception:
        raise HTTPException(status_code=400, detail="req must be valid JSON.")

    points = payload.get("points")
    labels = payload.get("labels")
    box = payload.get("box", None)

    if not isinstance(points, list) or not isinstance(labels, list):
        raise HTTPException(status_code=400, detail="points/labels required.")
    if len(points) == 0 or len(points) != len(labels):
        raise HTTPException(status_code=400, detail="points/labels required and must match lengths.")

    raw = read_limited(file)
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image.")

    image = np.array(img)  # HWC RGB uint8

    predictor = get_predictor()
    predictor.set_image(image)

    point_coords = np.array(points, dtype=np.float32)
    point_labels = np.array(labels, dtype=np.int32)

    box_arr = None
    if box is not None:
        if (not isinstance(box, list)) or len(box) != 4:
            raise HTTPException(status_code=400, detail="box must be [x1,y1,x2,y2].")
        box_arr = np.array(box, dtype=np.float32)

    try:
        masks, scores, _ = predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            box=box_arr,
            multimask_output=False,
        )
        mask = masks[0].astype(np.uint8) * 255  # 0/255
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SAM failed: {type(e).__name__}")

    out = Image.fromarray(mask, mode="L")
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return Response(content=buf.getvalue(), media_type="image/png")
