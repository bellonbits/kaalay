from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Ride, RideStatus, User, Driver, Payment, Incident, IncidentStatus
from pydantic import BaseModel
from typing import Optional
import uuid

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

# ── User management ───────────────────────────────────────────────────────

def _user_out(user: User) -> dict:
    return {
        "id": str(user.id),
        "fullName": user.fullName,
        "phoneNumber": user.phoneNumber,
        "email": user.email,
        "role": user.role,
        "isActive": user.isActive,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
    }

@router.get("/users")
async def list_users(q: str = None, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    query = db.query(User)
    if q:
        query = query.filter(User.fullName.ilike(f"%{q}%") | User.phoneNumber.ilike(f"%{q}%"))
    users = query.order_by(User.createdAt.desc()).limit(200).all()
    return success_response([_user_out(u) for u in users])

class UserUpdate(BaseModel):
    isActive: Optional[bool] = None
    role: Optional[str] = None

@router.patch("/users/{id}")
async def update_user(id: uuid.UUID, dto: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        return error_response("NOT_FOUND", "User not found", 404)
    if dto.isActive is not None:
        user.isActive = dto.isActive
    if dto.role is not None:
        user.role = dto.role
    db.commit()
    db.refresh(user)
    return success_response(_user_out(user))

# ── Driver management ─────────────────────────────────────────────────────

def _admin_driver_out(driver: Driver) -> dict:
    return {
        "id": str(driver.id),
        "userId": str(driver.userId),
        "fullName": driver.user.fullName if driver.user else None,
        "phoneNumber": driver.user.phoneNumber if driver.user else None,
        "vehicleModel": driver.vehicleModel,
        "vehicleColor": driver.vehicleColor,
        "licensePlate": driver.licensePlate,
        "vehicleCategory": driver.vehicleCategory,
        "nationalIdUrl": driver.nationalIdUrl,
        "drivingLicenseUrl": driver.drivingLicenseUrl,
        "isVerified": driver.isVerified,
        "status": driver.status,
        "rating": driver.rating,
        "acceptanceRate": driver.acceptanceRate,
    }

@router.get("/drivers")
async def list_drivers(verified: bool = None, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    from sqlalchemy.orm import joinedload
    query = db.query(Driver).options(joinedload(Driver.user))
    if verified is not None:
        query = query.filter(Driver.isVerified == verified)
    drivers = query.order_by(Driver.lastSeen.desc()).limit(200).all()
    return success_response([_admin_driver_out(d) for d in drivers])

class DriverVerifyUpdate(BaseModel):
    isVerified: bool

@router.patch("/drivers/{id}/verify")
async def verify_driver(id: uuid.UUID, dto: DriverVerifyUpdate, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    driver = db.query(Driver).filter(Driver.id == id).first()
    if not driver:
        return error_response("NOT_FOUND", "Driver not found", 404)
    driver.isVerified = dto.isVerified
    db.commit()
    db.refresh(driver)
    return success_response(_admin_driver_out(driver))

class DriverStatusUpdate(BaseModel):
    status: str

@router.patch("/drivers/{id}/status")
async def force_driver_status(id: uuid.UUID, dto: DriverStatusUpdate, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    driver = db.query(Driver).filter(Driver.id == id).first()
    if not driver:
        return error_response("NOT_FOUND", "Driver not found", 404)
    driver.status = dto.status
    db.commit()
    if dto.status != "online":
        from ..core.redis import get_redis
        get_redis().zrem("driver_locations", str(driver.id))
    return success_response(_admin_driver_out(driver))

# ── Ride management ───────────────────────────────────────────────────────

@router.get("/rides")
async def list_all_rides(status: str = None, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    from .rides import _ride_out
    query = db.query(Ride)
    if status:
        query = query.filter(Ride.status == status)
    rides = query.order_by(Ride.createdAt.desc()).limit(200).all()
    return success_response([_ride_out(r) for r in rides])

@router.patch("/rides/{id}/cancel")
async def force_cancel_ride(id: uuid.UUID, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    from .rides import _update_ride_status_internal
    return await _update_ride_status_internal(id, RideStatus.CANCELLED, db)

# ── Incident resolution ───────────────────────────────────────────────────

class IncidentUpdate(BaseModel):
    status: str

@router.patch("/incidents/{id}")
async def update_incident(id: uuid.UUID, dto: IncidentUpdate, db: Session = Depends(get_db), admin: User = Depends(is_admin)):
    from datetime import datetime
    incident = db.query(Incident).filter(Incident.id == id).first()
    if not incident:
        return error_response("NOT_FOUND", "Incident not found", 404)
    incident.status = dto.status
    if dto.status == IncidentStatus.RESOLVED:
        incident.resolvedAt = datetime.utcnow()
    db.commit()
    db.refresh(incident)
    return success_response({
        "id": str(incident.id),
        "status": incident.status,
        "resolvedAt": incident.resolvedAt.isoformat() if incident.resolvedAt else None,
    })
