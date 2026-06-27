from fastapi import APIRouter, UploadFile, File, Depends
from ..core.responses import success_response, error_response
from ..core.deps import get_current_user
from ..models.all import User
import os
import uuid

router = APIRouter(prefix="/uploads", tags=["uploads"])

# apps/backend/uploads — matches the Dockerfile's WORKDIR /app (the whole
# apps/backend tree is COPY'd there), and matches the repo root when running
# locally with CWD=apps/backend. Mounted as static content in main.py using
# this same constant, so the two never drift apart.
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_SIZE_BYTES = 8 * 1024 * 1024  # 8MB


@router.post("/image")
async def upload_image(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        return error_response("INVALID_FILE_TYPE", "Only JPEG, PNG, WEBP, or GIF images are allowed", 400)

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        return error_response("FILE_TOO_LARGE", "Image must be smaller than 8MB", 400)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)

    return success_response({"url": f"/uploads/{filename}"})
