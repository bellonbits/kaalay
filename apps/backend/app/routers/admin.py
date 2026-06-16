from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Ride, RideStatus, User, Driver, Payment, Incident, IncidentStatus

router = APIRouter(prefix="/admin", tags=["admin"])

def is_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.get("/dashboard-stats")
async def get_dashboard_stats(db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    # Calculate key metrics for the ops dashboard
    active_trips_count = db.query(Ride).filter(Ride.status.in_([RideStatus.ACCEPTED, RideStatus.ARRIVING, RideStatus.STARTED])).count()
    completed_trips_count = db.query(Ride).filter(Ride.status == RideStatus.COMPLETED).count()
    
    total_drivers = db.query(Driver).count()
    verified_drivers = db.query(Driver).filter(Driver.isVerified == True).count()
    
    total_revenue = db.query(func.sum(Payment.amount)).filter(Payment.status == "completed").scalar() or 0
    
    return success_response({
        "activeTrips": active_trips_count,
        "completedTrips": completed_trips_count,
        "totalDrivers": total_drivers,
        "verifiedDrivers": verified_drivers,
        "totalRevenue": total_revenue
    })

@router.get("/active-trips")
async def get_active_trips(db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    trips = db.query(Ride).filter(Ride.status.in_([
        RideStatus.REQUESTED, 
        RideStatus.ACCEPTED, 
        RideStatus.ARRIVING, 
        RideStatus.STARTED
    ])).order_by(Ride.createdAt.desc()).limit(50).all()
    
    # Format for the ops dashboard
    result = []
    for t in trips:
        result.append({
            "id": str(t.id),
            "status": t.status,
            "category": t.category,
            "pickup": f"///{t.pickupWhat3words}",
            "destination": f"///{t.destinationWhat3words}",
            "fare": t.fare,
            "createdAt": t.createdAt.isoformat()
        })

    return success_response(result)

@router.get("/incidents")
async def list_incidents(status: str = None, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    else:
        query = query.filter(Incident.status.in_([IncidentStatus.OPEN, IncidentStatus.DISPATCHED]))

    incidents = query.order_by(Incident.createdAt.desc()).limit(100).all()
    result = []
    for i in incidents:
        result.append({
            "id": str(i.id),
            "reporterId": str(i.reporterId) if i.reporterId else None,
            "type": i.type,
            "severity": i.severity,
            "status": i.status,
            "silent": i.silent,
            "lat": i.lat,
            "lng": i.lng,
            "what3words": i.what3words,
            "message": i.message,
            "createdAt": i.createdAt.isoformat() if i.createdAt else None,
        })
    return success_response(result)

@router.get("/incidents/stats")
async def get_incident_stats(db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    open_count = db.query(Incident).filter(Incident.status == IncidentStatus.OPEN).count()
    dispatched_count = db.query(Incident).filter(Incident.status == IncidentStatus.DISPATCHED).count()
    resolved_count = db.query(Incident).filter(Incident.status == IncidentStatus.RESOLVED).count()

    by_severity = dict(
        db.query(Incident.severity, func.count(Incident.id))
        .filter(Incident.status.in_([IncidentStatus.OPEN, IncidentStatus.DISPATCHED]))
        .group_by(Incident.severity)
        .all()
    )
    by_type = dict(
        db.query(Incident.type, func.count(Incident.id))
        .filter(Incident.status.in_([IncidentStatus.OPEN, IncidentStatus.DISPATCHED]))
        .group_by(Incident.type)
        .all()
    )

    return success_response({
        "open": open_count,
        "dispatched": dispatched_count,
        "resolved": resolved_count,
        "bySeverity": by_severity,
        "byType": by_type,
    })
