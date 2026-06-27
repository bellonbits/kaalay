from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import RoadReport, RoadReportStatus, User
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/road-reports", tags=["road-reports"])


def _report_out(report: RoadReport) -> dict:
    return {
        "id": str(report.id),
        "reporterId": str(report.reporterId) if report.reporterId else None,
        "type": report.type,
        "lat": report.lat,
        "lng": report.lng,
        "description": report.description,
        "status": report.status,
        "createdAt": report.createdAt.isoformat() if report.createdAt else None,
        "resolvedAt": report.resolvedAt.isoformat() if report.resolvedAt else None,
    }


class RoadReportCreate(BaseModel):
    type: str
    lat: float
    lng: float
    description: Optional[str] = None


@router.post("")
async def create_report(
    dto: RoadReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    report = RoadReport(
        reporterId=current_user.id, type=dto.type, lat=dto.lat, lng=dto.lng, description=dto.description
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return success_response(_report_out(report))


@router.get("/nearby")
async def get_nearby_reports(lat: float, lng: float, radius: float = 5.0, db: Session = Depends(get_db)):
    deg_radius = radius / 111
    reports = (
        db.query(RoadReport)
        .filter(
            RoadReport.status == RoadReportStatus.ACTIVE,
            RoadReport.lat.between(lat - deg_radius, lat + deg_radius),
            RoadReport.lng.between(lng - deg_radius, lng + deg_radius),
        )
        .order_by(RoadReport.createdAt.desc())
        .limit(100)
        .all()
    )
    return success_response([_report_out(r) for r in reports])


@router.patch("/{id}/resolve")
async def resolve_report(
    id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    report = db.query(RoadReport).filter(RoadReport.id == id).first()
    if not report:
        return error_response("REPORT_NOT_FOUND", "Report not found", 404)
    # Either the original reporter (the road cleared up) or an admin can
    # resolve it — no moderation queue needed for a low-stakes road report.
    if current_user.role != "admin" and str(report.reporterId) != str(current_user.id):
        return error_response("FORBIDDEN", "Only the reporter or an admin can resolve this", 403)
    report.status = RoadReportStatus.RESOLVED
    report.resolvedAt = datetime.utcnow()
    db.commit()
    return success_response(_report_out(report))
