from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.responses import success_response, error_response
from ..models.all import Place
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter(prefix="/places", tags=["places"])

class PlaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    lat: float
    lng: float
    words: str
    tags: Optional[List[str]] = []

@router.post("")
async def create_place(dto: PlaceCreate, db: Session = Depends(get_db)):
    place = Place(
        name=dto.name,
        description=dto.description,
        latitude=dto.lat,
        longitude=dto.lng,
        words=dto.words,
        tags=dto.tags
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return success_response(place)

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
    return success_response(places)

@router.get("/search")
async def search_places(q: str, db: Session = Depends(get_db)):
    places = db.query(Place).filter(Place.name.ilike(f"%{q}%")).all()
    return success_response(places)

@router.get("")
async def list_places(db: Session = Depends(get_db)):
    places = db.query(Place).all()
    return success_response(places)

@router.get("/{id}")
async def get_place(id: str, db: Session = Depends(get_db)):
    place = db.query(Place).filter(Place.id == id).first()
    if not place:
        return error_response("PLACE_NOT_FOUND", "Place not found", 404)
    return success_response(place)
