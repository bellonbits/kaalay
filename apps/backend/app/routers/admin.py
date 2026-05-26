from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Ride, RideStatus, User, Driver, Payment

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
