from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.responses import success_response, error_response
from ..models.all import Place
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


def _place_out(place: Place) -> dict:
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
        "createdAt": place.createdAt.isoformat() if place.createdAt else None,
    }


@router.post("")
async def create_place(dto: PlaceCreate, db: Session = Depends(get_db)):
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
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return success_response(_place_out(place))

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
    return success_response([_place_out(p) for p in places])

@router.get("/search")
async def search_places(q: str, db: Session = Depends(get_db)):
    places = db.query(Place).filter(Place.name.ilike(f"%{q}%")).all()
    return success_response([_place_out(p) for p in places])

@router.get("")
async def list_places(db: Session = Depends(get_db)):
    places = db.query(Place).all()
    return success_response([_place_out(p) for p in places])

@router.get("/{id}")
async def get_place(id: str, db: Session = Depends(get_db)):
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    return success_response(_place_out(place))

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
    return success_response(_place_out(place))

@router.delete("/{id}")
async def delete_place(id: str, db: Session = Depends(get_db), admin = Depends(is_admin)):
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    db.delete(place)
    db.commit()
    return success_response({"id": id, "deleted": True})
