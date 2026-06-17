from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Ride, RideStatus, User, Driver
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter(prefix="/rides", tags=["rides"])

def _ride_out(ride: Ride) -> dict:
    """Plain-dict projection of a Ride — mirrors places.py's _place_out
    pattern. Returning the raw SQLAlchemy ORM object through
    success_response() doesn't serialize cleanly (FastAPI's encoder chokes
    on SQLAlchemy's internal _sa_instance_state)."""
    driver_out = None
    if ride.driver:
        driver_out = {
            "id": str(ride.driver.id),
            "fullName": ride.driver.user.fullName if ride.driver.user else None,
            "phoneNumber": ride.driver.user.phoneNumber if ride.driver.user else None,
            "vehicleModel": ride.driver.vehicleModel,
            "vehicleColor": ride.driver.vehicleColor,
            "licensePlate": ride.driver.licensePlate,
            "rating": ride.driver.rating,
            "currentLat": ride.driver.currentLat,
            "currentLng": ride.driver.currentLng,
        }
    rider_out = None
    if ride.rider:
        rider_out = {
            "id": str(ride.rider.id),
            "fullName": ride.rider.fullName,
            "phoneNumber": ride.rider.phoneNumber,
        }
    return {
        "id": str(ride.id),
        "riderId": str(ride.riderId),
        "driverId": str(ride.driverId) if ride.driverId else None,
        "status": ride.status,
        "category": ride.category,
        "pickupLat": ride.pickupLat,
        "pickupLng": ride.pickupLng,
        "pickupWhat3words": ride.pickupWhat3words,
        "destinationLat": ride.destinationLat,
        "destinationLng": ride.destinationLng,
        "destinationWhat3words": ride.destinationWhat3words,
        "fare": ride.fare,
        "distance": ride.distance,
        "duration": ride.duration,
        "createdAt": ride.createdAt.isoformat() if ride.createdAt else None,
        "updatedAt": ride.updatedAt.isoformat() if ride.updatedAt else None,
        "driver": driver_out,
        "rider": rider_out,
    }

@router.get("/nearby")
async def get_nearby_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only return rides that are still waiting for a driver
    rides = db.query(Ride).options(joinedload(Ride.rider)).filter(
        Ride.status == RideStatus.REQUESTED
    ).order_by(Ride.createdAt.desc()).all()
    return success_response([_ride_out(r) for r in rides])

class LocationPoint(BaseModel):
    lat: float
    lng: float
    words: str

class RideCreate(BaseModel):
    pickup: LocationPoint
    destination: LocationPoint
    category: Optional[str] = "economy"
    distance: Optional[float] = 0.0 # in km
    duration: Optional[float] = 0.0 # in minutes

class EstimateRequest(BaseModel):
    distance: Optional[float] = 0.0 # in km
    category: Optional[str] = "economy"

@router.post("/estimate")
async def estimate_fares(dto: EstimateRequest):
    # Basic pricing logic (should match create_ride)
    base_fares = {"economy": 50.0, "bike": 30.0, "xl": 100.0, "delivery": 40.0}
    per_km_rates = {"economy": 40.0, "bike": 20.0, "xl": 70.0, "delivery": 30.0}
    
    estimates = []
    for cat in ["economy", "bike", "xl", "delivery"]:
        base = base_fares.get(cat, 50.0)
        per_km = per_km_rates.get(cat, 40.0)
        fare = base + (per_km * (dto.distance or 0))
        estimates.append({
            "category": cat,
            "fare": fare,
            "currency": "KES",
            "eta": 5 # Placeholder for ETA logic
        })
    return success_response(estimates)

@router.post("")
async def create_ride(
    dto: RideCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Basic pricing logic
    base_fares = {
        "economy": 50.0,
        "bike": 30.0,
        "xl": 100.0,
        "delivery": 40.0
    }
    per_km_rates = {
        "economy": 40.0,
        "bike": 20.0,
        "xl": 70.0,
        "delivery": 30.0
    }
    
    category = dto.category.lower() if dto.category else "economy"
    base = base_fares.get(category, 50.0)
    per_km = per_km_rates.get(category, 40.0)
    calculated_fare = base + (per_km * (dto.distance or 0))
    
    ride = Ride(
        riderId=current_user.id,
        pickupLat=dto.pickup.lat,
        pickupLng=dto.pickup.lng,
        pickupWhat3words=dto.pickup.words,
        destinationLat=dto.destination.lat,
        destinationLng=dto.destination.lng,
        destinationWhat3words=dto.destination.words,
        status=RideStatus.REQUESTED,
        category=category,
        fare=calculated_fare,
        distance=dto.distance,
        duration=dto.duration
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    
    # Dispatching Logic: Asynchronous Event Publishing (Decoupled architecture)
    try:
        from ..core.queue import publish_ride_request
        payload = {
            "pickupLat": ride.pickupLat,
            "pickupLng": ride.pickupLng,
            "pickupWhat3words": ride.pickupWhat3words,
            "destinationWhat3words": ride.destinationWhat3words,
            "category": category,
            "fare": calculated_fare
        }
        await publish_ride_request(str(ride.id), payload)
    except Exception as e:
        print(f"Queue Publishing Error: {e}")

    return success_response(_ride_out(ride))

@router.get("/history")
async def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rides = db.query(Ride).filter(Ride.riderId == current_user.id).order_by(Ride.createdAt.desc()).all()
    return success_response([_ride_out(r) for r in rides])

@router.get("/{id}")
async def get_ride(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ride = db.query(Ride).filter(Ride.id == id).first()
    if not ride:
        return error_response("NOT_FOUND", "Ride not found", 404)
    return success_response(_ride_out(ride))

async def _update_ride_status_internal(id: uuid.UUID, status: str, db: Session, driver: Optional[Driver] = None):
    ride = db.query(Ride).options(joinedload(Ride.driver).joinedload(Driver.user)).filter(Ride.id == id).first()
    if not ride:
        return error_response("NOT_FOUND", "Ride not found", 404)
    
    ride.status = status
    if driver:
        ride.driverId = driver.id
    db.commit()
    
    # ── Build human-readable notification ───────────────────────────────────
    STATUS_NOTIF = {
        RideStatus.ACCEPTED:   ("🚗 Driver Accepted!", "Your driver is on the way to pick you up.", "success"),
        RideStatus.ARRIVING:   ("📍 Driver Arriving", "Your driver is almost at your pickup point.", "info"),
        RideStatus.ARRIVED:    ("✅ Driver Arrived", "Your driver is waiting for you now.", "success"),
        RideStatus.STARTED:    ("🚀 Ride Started", "You are now on your way. Enjoy the ride!", "info"),
        RideStatus.COMPLETED:  ("🎉 Ride Completed", "Your ride has ended. Thank you for using Kaalay!", "success"),
        RideStatus.CANCELLED:  ("❌ Ride Cancelled", "Your ride was cancelled.", "warning"),
    }
    notif_meta = STATUS_NOTIF.get(status)
    
    notif_payload = None
    if notif_meta and ride.riderId:
        from ..models.all import Notification
        from datetime import datetime
        notif = Notification(
            userId=ride.riderId,
            title=notif_meta[0],
            message=notif_meta[1],
            type=notif_meta[2],
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        notif_payload = {
            "id": str(notif.id),
            "title": notif.title,
            "message": notif.message,
            "type": notif.type,
            "read": False,
            "createdAt": notif.createdAt.isoformat(),
        }
    
    # ── Notify participants via Socket.IO ────────────────────────────────────
    try:
        from ..core.sio import sio, NAMESPACE
        driver_name = (
            driver.user.fullName if driver and driver.user
            else (ride.driver.user.fullName if ride.driver and ride.driver.user else "Driver")
        )
        payload = {
            "id": str(id),
            "status": status,
            "driverName": driver_name,
            "vehicleModel": driver.vehicleModel if driver else (ride.driver.vehicleModel if ride.driver else None),
            "licensePlate": driver.licensePlate if driver else (ride.driver.licensePlate if ride.driver else None),
            "helperId": str(driver.userId) if driver else (str(ride.driver.userId) if ride.driver else None),
        }
        # Status update to the ride room (rider + driver both in this room)
        await sio.emit("status", payload, room=str(id), namespace=NAMESPACE)
        
        # Push the notification event directly to the rider's room
        if notif_payload:
            await sio.emit("notification", notif_payload, room=str(id), namespace=NAMESPACE)
        
        # If accepted or cancelled, clear other drivers' screens
        if status in [RideStatus.ACCEPTED, RideStatus.CANCELLED]:
            event = "request-claimed" if status == RideStatus.ACCEPTED else "request-cancelled"
            await sio.emit(event, {"shareCode": str(id), "id": str(id)}, room="dispatch", namespace=NAMESPACE)
    except Exception as e:
        print(f"Status Socket Error: {e}")

    return success_response(_ride_out(ride))


@router.patch("/{id}/status")
async def update_ride_status(id: uuid.UUID, status: str, db: Session = Depends(get_db)):
    return await _update_ride_status_internal(id, status, db)

@router.patch("/{id}/arriving")
async def signal_arriving(id: uuid.UUID, db: Session = Depends(get_db)):
    return await _update_ride_status_internal(id, RideStatus.ARRIVING, db)

@router.patch("/{id}/arrived")
async def signal_arrived(id: uuid.UUID, db: Session = Depends(get_db)):
    return await _update_ride_status_internal(id, RideStatus.ARRIVED, db)

@router.patch("/{id}/start")
async def start_ride(id: uuid.UUID, db: Session = Depends(get_db)):
    return await _update_ride_status_internal(id, RideStatus.STARTED, db)

@router.patch("/{id}/complete")
async def complete_ride(id: uuid.UUID, db: Session = Depends(get_db)):
    return await _update_ride_status_internal(id, RideStatus.COMPLETED, db)

@router.patch("/{id}/cancel")
async def cancel_ride(id: uuid.UUID, db: Session = Depends(get_db)):
    return await _update_ride_status_internal(id, RideStatus.CANCELLED, db)

def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math
    R = 6371000  # Earth radius in metres
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = math.sin(dLat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

ARRIVING_THRESHOLD_METERS = 500
ARRIVED_THRESHOLD_METERS = 40

class DriverLocationUpdate(BaseModel):
    lat: float
    lng: float
    heading: Optional[float] = None
    speed: Optional[float] = None

@router.patch("/{id}/location")
async def update_driver_location(
    id: uuid.UUID,
    dto: DriverLocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Called by the driver app on every GPS tick during an active ride.
    Updates the driver's last-known position, auto-promotes the ride status
    once the driver is close enough to the current target leg (pickup before
    ARRIVED, destination once STARTED), and streams the position to the
    rider over the ride's Socket.IO room."""
    driver = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_DRIVER", "You are not registered as a driver", 403)

    ride = db.query(Ride).filter(Ride.id == id).first()
    if not ride:
        return error_response("NOT_FOUND", "Ride not found", 404)
    if ride.driverId != driver.id:
        return error_response("FORBIDDEN", "You are not the driver for this ride", 403)
    if ride.status not in (RideStatus.ACCEPTED, RideStatus.ARRIVING, RideStatus.ARRIVED, RideStatus.STARTED):
        return error_response("INVALID_STATUS", "Ride is not active", 400)

    driver.currentLat = dto.lat
    driver.currentLng = dto.lng
    db.commit()

    pre_pickup = ride.status in (RideStatus.ACCEPTED, RideStatus.ARRIVING)
    target_lat = ride.pickupLat if pre_pickup else ride.destinationLat
    target_lng = ride.pickupLng if pre_pickup else ride.destinationLng
    distance_meters = _haversine_meters(dto.lat, dto.lng, target_lat, target_lng)

    if ride.status == RideStatus.ACCEPTED and distance_meters < ARRIVING_THRESHOLD_METERS:
        await _update_ride_status_internal(id, RideStatus.ARRIVING, db)
    elif ride.status == RideStatus.ARRIVING and distance_meters < ARRIVED_THRESHOLD_METERS:
        await _update_ride_status_internal(id, RideStatus.ARRIVED, db)

    try:
        from ..core.sio import sio, NAMESPACE
        avg_speed = max(dto.speed or 4.0, 1.0)  # m/s, floor avoids a divide-by-near-zero ETA spike
        await sio.emit("driver-location", {
            "id": str(id),
            "lat": dto.lat,
            "lng": dto.lng,
            "heading": dto.heading,
            "distanceMeters": distance_meters,
            "etaSeconds": distance_meters / avg_speed,
        }, room=str(id), namespace=NAMESPACE)
    except Exception as e:
        print(f"Driver Location Socket Error: {e}")

    return success_response({"distanceMeters": distance_meters})

@router.post("/{id}/accept")
async def accept_ride(id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    driver = db.query(Driver).options(joinedload(Driver.user)).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_DRIVER", "You are not registered as a driver", 403)
    
    return await _update_ride_status_internal(id, RideStatus.ACCEPTED, db, driver=driver)

class RatingCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

@router.post("/{id}/rating")
async def rate_ride(id: uuid.UUID, dto: RatingCreate, db: Session = Depends(get_db)):
    from ..models.all import Rating
    
    ride = db.query(Ride).filter(Ride.id == id).first()
    if not ride or not ride.driverId:
        return error_response("NOT_FOUND", "Ride or driver not found", 404)
        
    existing = db.query(Rating).filter(Rating.rideId == id).first()
    if existing:
        return error_response("ALREADY_RATED", "Ride already rated", 400)
        
    rating = Rating(
        rideId=id,
        driverId=ride.driverId,
        rating=dto.rating,
        comment=dto.comment
    )
    db.add(rating)
    db.commit()
    
    return success_response({"message": "Rating submitted successfully"})
