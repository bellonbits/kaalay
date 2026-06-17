from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Driver, DriverStatus, User
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/drivers", tags=["drivers"])

def _driver_out(driver: Driver) -> dict:
    return {
        "id": str(driver.id),
        "userId": str(driver.userId),
        "vehicleModel": driver.vehicleModel,
        "vehicleColor": driver.vehicleColor,
        "licensePlate": driver.licensePlate,
        "vehicleCategory": driver.vehicleCategory,
        "isVerified": driver.isVerified,
        "status": driver.status,
        "rating": driver.rating,
        "acceptanceRate": driver.acceptanceRate,
        "currentLat": driver.currentLat,
        "currentLng": driver.currentLng,
    }

class DriverRegister(BaseModel):
    vehicleModel: str
    vehicleColor: str
    licensePlate: str
    vehicleCategory: str = "economy"
    nationalIdUrl: str = None
    drivingLicenseUrl: str = None

@router.post("/register")
async def register_driver(
    dto: DriverRegister, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if user already has a driver profile
    existing = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if existing:
        return error_response("ALREADY_EXISTS", "Driver profile already exists", 400)
    
    driver = Driver(
        userId=current_user.id,
        vehicleModel=dto.vehicleModel,
        vehicleColor=dto.vehicleColor,
        licensePlate=dto.licensePlate,
        vehicleCategory=dto.vehicleCategory,
        nationalIdUrl=dto.nationalIdUrl,
        drivingLicenseUrl=dto.drivingLicenseUrl,
        status=DriverStatus.OFFLINE
    )
    
    # Update user role to driver
    current_user.role = "driver"
    
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return success_response(_driver_out(driver))

@router.get("/me")
async def get_driver_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    driver = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_FOUND", "No driver profile found for this user", 404)
    return success_response(_driver_out(driver))

@router.patch("/status")
async def update_status(
    status: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    driver = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_FOUND", "Driver profile not found", 404)
    
    driver.status = status
    db.commit()
    
    # Sync with Redis GEO pool
    from ..core.redis import get_redis
    r = get_redis()
    if status != DriverStatus.ONLINE:
        # Remove from active pool if busy or offline
        r.zrem("driver_locations", str(driver.id))
        
    return success_response({"status": driver.status})

@router.get("/wallet")
async def get_driver_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import func
    from ..models.all import Ride, Payment
    
    driver = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_FOUND", "Driver profile not found", 404)
        
    # Calculate earnings from completed rides via Payment table
    total_earned = db.query(func.sum(Payment.amount))\
        .join(Ride, Ride.id == Payment.rideId)\
        .filter(Ride.driverId == driver.id, Payment.status == "pending").scalar() or 0 # Using pending temporarily as M-Pesa sandbox webhooks may not fire locally
        
    # Standard ride-hailing split: 80% Driver, 20% Kaalay Commission
    driver_balance = total_earned * 0.80
    platform_fee = total_earned * 0.20
    
    return success_response({
        "totalGross": total_earned,
        "walletBalance": driver_balance,
        "commissionPaid": platform_fee,
        "currency": "KES"
    })
