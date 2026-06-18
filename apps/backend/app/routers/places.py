from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Place, PlaceReview, PlaceNote, User
from .admin import is_admin
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, time as dtime
import uuid

router = APIRouter(prefix="/places", tags=["places"])

class PlaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    lat: float
    lng: float
    words: str
    tags: Optional[List[str]] = []
    photos: Optional[List[str]] = []
    alwaysOpen: Optional[bool] = True
    openTime: Optional[str] = None
    closeTime: Optional[str] = None


def _parse_hhmm(value: Optional[str]):
    if not value:
        return None
    try:
        h, m = value.split(":")
        return dtime(int(h), int(m))
    except (ValueError, TypeError):
        return None


def _is_open_now(place: Place) -> Optional[bool]:
    if place.alwaysOpen:
        return True
    open_t = _parse_hhmm(place.openTime)
    close_t = _parse_hhmm(place.closeTime)
    if not open_t or not close_t:
        return None  # unknown — no hours data to judge by
    now_t = datetime.now().time()
    if open_t <= close_t:
        return open_t <= now_t <= close_t
    return now_t >= open_t or now_t <= close_t  # overnight window, e.g. 20:00-02:00


def _place_out(place: Place, db: Session) -> dict:
    avg_rating, review_count = (
        db.query(func.avg(PlaceReview.rating), func.count(PlaceReview.id))
        .filter(PlaceReview.placeId == place.id)
        .first()
    )
    return {
        "id": str(place.id),
        "name": place.name,
        "description": place.description,
        "latitude": place.latitude,
        "longitude": place.longitude,
        "words": place.words,
        "tags": place.tags or [],
        "photos": place.photos or [],
        "alwaysOpen": place.alwaysOpen,
        "openTime": place.openTime,
        "closeTime": place.closeTime,
        "isOpenNow": _is_open_now(place),
        "visitCount": place.visitCount or 0,
        "averageRating": round(avg_rating, 1) if avg_rating else None,
        "reviewCount": review_count or 0,
        "createdBy": str(place.createdBy) if place.createdBy else None,
        "createdAt": place.createdAt.isoformat() if place.createdAt else None,
    }


@router.post("")
async def create_place(dto: PlaceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    place = Place(
        name=dto.name,
        description=dto.description,
        latitude=dto.lat,
        longitude=dto.lng,
        words=dto.words,
        tags=dto.tags,
        photos=dto.photos,
        alwaysOpen=dto.alwaysOpen if dto.alwaysOpen is not None else True,
        openTime=dto.openTime,
        closeTime=dto.closeTime,
        createdBy=current_user.id,
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return success_response(_place_out(place, db))

@router.get("/nearby")
async def get_nearby(lat: float, lng: float, radius: float = 0.1, db: Session = Depends(get_db)):
    # radius 0.1 is approx 11km. If user sends 5 (km), we convert.
    # For now, let's assume radius is in decimal degrees roughly or km.
    # Simplified: 0.01 per km.
    deg_radius = radius * 0.01 if radius > 1 else radius
    places = db.query(Place).filter(
        Place.latitude.between(lat - deg_radius, lat + deg_radius),
        Place.longitude.between(lng - deg_radius, lng + deg_radius)
    ).all()
    return success_response([_place_out(p, db) for p in places])

@router.get("/search")
async def search_places(q: str, db: Session = Depends(get_db)):
    places = db.query(Place).filter(Place.name.ilike(f"%{q}%")).all()
    return success_response([_place_out(p, db) for p in places])

@router.get("")
async def list_places(db: Session = Depends(get_db)):
    places = db.query(Place).all()
    return success_response([_place_out(p, db) for p in places])

@router.get("/{id}")
async def get_place(id: str, db: Session = Depends(get_db)):
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    return success_response(_place_out(place, db))

class PlaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    photos: Optional[List[str]] = None
    alwaysOpen: Optional[bool] = None
    openTime: Optional[str] = None
    closeTime: Optional[str] = None

@router.patch("/{id}")
async def update_place(id: str, dto: PlaceUpdate, db: Session = Depends(get_db), admin = Depends(is_admin)):
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    for field in ("name", "description", "tags", "photos", "alwaysOpen", "openTime", "closeTime"):
        value = getattr(dto, field)
        if value is not None:
            setattr(place, field, value)
    db.commit()
    db.refresh(place)
    return success_response(_place_out(place, db))

@router.delete("/{id}")
async def delete_place(id: str, db: Session = Depends(get_db), admin = Depends(is_admin)):
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    db.delete(place)
    db.commit()
    return success_response({"id": id, "deleted": True})

@router.post("/{id}/visit")
async def record_visit(id: str, db: Session = Depends(get_db)):
    """Called when a rider opens a place's detail screen — feeds the
    visitCount shown on Discover cards. Anonymous (no auth) since it's just
    a popularity counter, not user-attributed data."""
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    place.visitCount = (place.visitCount or 0) + 1
    db.commit()
    return success_response({"visitCount": place.visitCount})

# ── Reviews ──────────────────────────────────────────────────────────────

def _review_out(review: PlaceReview) -> dict:
    return {
        "id": str(review.id),
        "placeId": str(review.placeId),
        "userId": str(review.userId),
        "userName": review.user.fullName if review.user else None,
        "rating": review.rating,
        "comment": review.comment,
        "createdAt": review.createdAt.isoformat() if review.createdAt else None,
    }

class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

@router.post("/{id}/reviews")
async def create_review(
    id: str, dto: ReviewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    if dto.rating < 1 or dto.rating > 5:
        return error_response("INVALID_RATING", "Rating must be between 1 and 5", 400)

    existing = db.query(PlaceReview).filter(PlaceReview.placeId == id, PlaceReview.userId == current_user.id).first()
    if existing:
        existing.rating = dto.rating
        existing.comment = dto.comment
        db.commit()
        db.refresh(existing)
        return success_response(_review_out(existing))

    review = PlaceReview(placeId=id, userId=current_user.id, rating=dto.rating, comment=dto.comment)
    db.add(review)
    db.commit()
    db.refresh(review)
    return success_response(_review_out(review))

@router.get("/{id}/reviews")
async def list_reviews(id: str, db: Session = Depends(get_db)):
    reviews = db.query(PlaceReview).filter(PlaceReview.placeId == id).order_by(PlaceReview.createdAt.desc()).all()
    return success_response([_review_out(r) for r in reviews])

# ── Community notes (the last-meter directions Google Maps can't give) ────

def _note_out(note: PlaceNote) -> dict:
    return {
        "id": str(note.id),
        "placeId": str(note.placeId),
        "userId": str(note.userId),
        "userName": note.user.fullName if note.user else None,
        "text": note.text,
        "createdAt": note.createdAt.isoformat() if note.createdAt else None,
    }

class NoteCreate(BaseModel):
    text: str

@router.post("/{id}/notes")
async def create_note(
    id: str, dto: NoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    note = PlaceNote(placeId=id, userId=current_user.id, text=dto.text.strip())
    db.add(note)
    db.commit()
    db.refresh(note)
    return success_response(_note_out(note))

@router.get("/{id}/notes")
async def list_notes(id: str, db: Session = Depends(get_db)):
    notes = db.query(PlaceNote).filter(PlaceNote.placeId == id).order_by(PlaceNote.createdAt.desc()).all()
    return success_response([_note_out(n) for n in notes])
