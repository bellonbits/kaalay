from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Driver, DriverStatus, User
from pydantic import BaseModel
import uuid
import json
from datetime import datetime

router = APIRouter(prefix="/drivers", tags=["drivers"])

def _driver_out(driver: Driver, db: Session = None) -> dict:
    res = {
        "id": str(driver.id),
        "userId": str(driver.userId),
        "vehicleModel": driver.vehicleModel,
        "vehicleColor": driver.vehicleColor,
        "licensePlate": driver.licensePlate,
        "vehicleCategory": driver.vehicleCategory,
        "isVerified": driver.isVerified,
        "status": driver.status,
        "rating": driver.rating if driver.rating else 4.9,
        "acceptanceRate": driver.acceptanceRate if driver.acceptanceRate else 0.98,
        "currentLat": driver.currentLat,
        "currentLng": driver.currentLng,
    }
    
    if db:
        from ..models.all import Ride, Payment
        # Completed rides total
        completed_trips = db.query(Ride).filter(
            Ride.driverId == driver.id, 
            Ride.status == "completed"
        ).count()
        
        # Calculate gross earnings
        total_earned = db.query(func.sum(Payment.amount))\
            .join(Ride, Ride.id == Payment.rideId)\
            .filter(Ride.driverId == driver.id, Payment.status == "pending").scalar() or 0
            
        driver_balance = total_earned * 0.80
        
        # Fetch withdrawals from Redis
        from ..core.redis import get_redis
        try:
            r = get_redis()
            total_withdrawn = float(r.get(f"withdrawn:{driver.id}") or 0.0)
        except Exception:
            total_withdrawn = 0.0
            
        remaining_balance = max(0.0, driver_balance - total_withdrawn)
        
        res["completedTripsToday"] = completed_trips
        res["earningsToday"] = remaining_balance
        res["walletBalance"] = remaining_balance
    else:
        res["completedTripsToday"] = 0
        res["earningsToday"] = 0.0
        res["walletBalance"] = 0.0
        
    return res

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
    
    current_user.role = "driver"
    
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return success_response(_driver_out(driver, db))

@router.get("/me")
async def get_driver_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    driver = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_FOUND", "No driver profile found for this user", 404)
    return success_response(_driver_out(driver, db))

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
    
    from ..core.redis import get_redis
    try:
        r = get_redis()
        if status != DriverStatus.ONLINE:
            r.zrem("driver_locations", str(driver.id))
    except Exception:
        pass
        
    return success_response({"status": driver.status})

async def get_driver_wallet_internal(driver: Driver, db: Session) -> dict:
    from ..models.all import Ride, Payment
    
    total_earned = db.query(func.sum(Payment.amount))\
        .join(Ride, Ride.id == Payment.rideId)\
        .filter(Ride.driverId == driver.id, Payment.status == "pending").scalar() or 0
        
    driver_balance = total_earned * 0.80
    platform_fee = total_earned * 0.20
    
    from ..core.redis import get_redis
    try:
        r = get_redis()
        total_withdrawn = float(r.get(f"withdrawn:{driver.id}") or 0.0)
    except Exception:
        total_withdrawn = 0.0
        
    remaining_balance = max(0.0, driver_balance - total_withdrawn)
    
    return {
        "totalGross": total_earned,
        "walletBalance": remaining_balance,
        "commissionPaid": platform_fee + total_withdrawn,
        "currency": "KES"
    }

@router.get("/wallet")
async def get_driver_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    driver = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_FOUND", "Driver profile not found", 404)
        
    wallet_data = await get_driver_wallet_internal(driver, db)
    return success_response(wallet_data)

class WithdrawRequest(BaseModel):
    method: str
    amount: float
    recipient: str

@router.post("/withdraw")
async def withdraw_earnings(
    dto: WithdrawRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    driver = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_FOUND", "Driver profile not found", 404)
        
    wallet_data = await get_driver_wallet_internal(driver, db)
    balance = wallet_data["walletBalance"]
    
    if dto.amount <= 0:
        return error_response("INVALID_AMOUNT", "Withdrawal amount must be greater than zero", 400)
    if dto.amount > balance:
        return error_response("INSUFFICIENT_FUNDS", "Insufficient wallet balance", 400)
        
    from ..core.redis import get_redis
    try:
        r = get_redis()
        current_withdrawn = float(r.get(f"withdrawn:{driver.id}") or 0.0)
        r.set(f"withdrawn:{driver.id}", current_withdrawn + dto.amount)
        
        tx_log = {
            "id": str(uuid.uuid4())[:8].upper(),
            "amount": dto.amount,
            "method": dto.method,
            "recipient": dto.recipient,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success"
        }
        txs = json.loads(r.get(f"transactions:{driver.id}") or "[]")
        txs.insert(0, tx_log)
        r.set(f"transactions:{driver.id}", json.dumps(txs))
    except Exception as e:
        return error_response("REDIS_WRITE_FAILED", f"Could not record withdrawal transaction: {e}", 502)
        
    return success_response({
        "message": f"Successfully withdrew KES {dto.amount:.2f} via {dto.method.upper()}",
        "newBalance": balance - dto.amount,
        "transaction": tx_log
    })

@router.get("/transactions")
async def get_withdrawal_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    driver = db.query(Driver).filter(Driver.userId == current_user.id).first()
    if not driver:
        return error_response("NOT_FOUND", "Driver profile not found", 404)
        
    from ..core.redis import get_redis
    try:
        r = get_redis()
        txs = json.loads(r.get(f"transactions:{driver.id}") or "[]")
    except Exception:
        txs = []
        
    return success_response(txs)
