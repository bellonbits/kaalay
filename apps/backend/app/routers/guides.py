from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import LocalGuide, User
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/guides", tags=["guides"])


class WaypointIn(BaseModel):
    lat: float
    lng: float


class GuideCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    waypoints: List[WaypointIn]
    distanceKm: Optional[float] = None


def _guide_out(guide: LocalGuide) -> dict:
    return {
        "id": str(guide.id),
        "name": guide.name,
        "description": guide.description,
        "category": guide.category,
        "createdBy": str(guide.createdBy),
        "creatorName": guide.creator.fullName if guide.creator else None,
        "startLat": guide.startLat,
        "startLng": guide.startLng,
        "endLat": guide.endLat,
        "endLng": guide.endLng,
        "waypoints": guide.waypoints or [],
        "distanceKm": guide.distanceKm,
        "timesUsed": guide.timesUsed or 0,
        "createdAt": guide.createdAt.isoformat() if guide.createdAt else None,
    }


@router.post("")
async def create_guide(
    dto: GuideCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if len(dto.waypoints) < 2:
        return error_response("INVALID_ROUTE", "A guide needs at least a start and end point", 400)
    start = dto.waypoints[0]
    end = dto.waypoints[-1]
    guide = LocalGuide(
        name=dto.name,
        description=dto.description,
        category=dto.category,
        createdBy=current_user.id,
        startLat=start.lat,
        startLng=start.lng,
        endLat=end.lat,
        endLng=end.lng,
        waypoints=[w.dict() for w in dto.waypoints],
        distanceKm=dto.distanceKm,
    )
    db.add(guide)
    db.commit()
    db.refresh(guide)
    return success_response(_guide_out(guide))


@router.get("/nearby")
async def get_nearby_guides(lat: float, lng: float, radius: float = 5.0, db: Session = Depends(get_db)):
    deg_radius = radius / 111  # km -> degrees, rough — consistent with places.py's nearby search
    guides = (
        db.query(LocalGuide)
        .options(joinedload(LocalGuide.creator))
        .filter(
            LocalGuide.startLat.between(lat - deg_radius, lat + deg_radius),
            LocalGuide.startLng.between(lng - deg_radius, lng + deg_radius),
        )
        .order_by(LocalGuide.timesUsed.desc())
        .limit(50)
        .all()
    )
    return success_response([_guide_out(g) for g in guides])


@router.get("/{id}")
async def get_guide(id: str, db: Session = Depends(get_db)):
    guide = db.query(LocalGuide).filter(LocalGuide.id == id).first()
    if not guide:
        return error_response("GUIDE_NOT_FOUND", "Guide not found", 404)
    return success_response(_guide_out(guide))


@router.post("/{id}/use")
async def use_guide(id: str, db: Session = Depends(get_db)):
    guide = db.query(LocalGuide).filter(LocalGuide.id == id).first()
    if not guide:
        return error_response("GUIDE_NOT_FOUND", "Guide not found", 404)
    guide.timesUsed = (guide.timesUsed or 0) + 1
    db.commit()
    return success_response({"timesUsed": guide.timesUsed})
