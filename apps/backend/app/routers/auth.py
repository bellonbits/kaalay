from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from ..core.database import get_db
from ..core.security import (
    create_access_token, 
    create_refresh_token,
    decode_token
)
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import User, Driver
from pydantic import BaseModel, EmailStr
import uuid
import random
from ..core.redis import get_redis

router = APIRouter(prefix="/auth", tags=["auth"])

class SendOtpRequest(BaseModel):
    phoneNumber: str

class LoginRequest(BaseModel):
    phoneNumber: str

class RegisterRequest(BaseModel):
    phoneNumber: str
    fullName: str
    role: str = "rider"
    email: Optional[EmailStr] = None
    vehicleCategory: Optional[str] = None
    licensePlate: Optional[str] = None
    vehicleModel: Optional[str] = None
    vehicleColor: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    fullName: Optional[str] = None
    vehicleCategory: Optional[str] = None
    licensePlate: Optional[str] = None

@router.post("/send-otp")
async def send_otp(dto: SendOtpRequest):
    # Dummy endpoint kept for legacy frontend calls compatibility, always bypasses
    return success_response({"message": "OTP bypassed (Direct login active)" })

@router.post("/login")
async def login(dto: LoginRequest, db: Session = Depends(get_db)):
    phone = dto.phoneNumber.strip()
    user = db.query(User).filter(User.phoneNumber == phone).first()
    
    if user:
        # Existing user: complete login
        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)
        
        user_data = {
            "id": str(user.id),
            "fullName": user.fullName,
            "phoneNumber": user.phoneNumber,
            "email": user.email,
            "role": user.role,
        }
        if user.role in ["driver", "helper"] and user.driverProfile:
            user_data["vehicleCategory"] = user.driverProfile.vehicleCategory
            user_data["licensePlate"] = user.driverProfile.licensePlate
            
        return success_response({
            "token": access_token,
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "user": user_data,
            "isNewUser": False
        })
    else:
        # New user: direct transition to registration
        return success_response({
            "token": None,
            "accessToken": None,
            "refreshToken": None,
            "user": None,
            "isNewUser": True
        })

PUBLIC_SIGNUP_ROLES = {"rider", "driver", "emergency_operator"}

@router.post("/register")
async def register(dto: RegisterRequest, db: Session = Depends(get_db)):
    phone = dto.phoneNumber.strip()

    role = (dto.role or "rider").lower()
    if role not in PUBLIC_SIGNUP_ROLES:
        return error_response("INVALID_ROLE", "role must be one of: rider, driver, emergency_operator", 400)

    # Check if user exists
    existing = db.query(User).filter(User.phoneNumber == phone).first()
    if existing:
        return error_response("CONFLICT", "User is already registered", 409)
        
    # Check if email is already taken
    if dto.email:
        email_clean = dto.email.strip().lower()
        existing_email = db.query(User).filter(User.email == email_clean).first()
        if existing_email:
            return error_response("CONFLICT", "Email is already taken by another account", 409)
            
    # Create user directly
    user = User(
        fullName=dto.fullName,
        phoneNumber=phone,
        email=dto.email,
        hashedPassword=None, # passwordless flow
        role=role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # If driver, set up driver profile
    if role == "driver":
        driver = Driver(
            userId=user.id,
            vehicleModel=dto.vehicleModel,
            vehicleColor=dto.vehicleColor,
            vehicleCategory=dto.vehicleCategory or "economy",
            licensePlate=dto.licensePlate,
            status="offline"
        )
        db.add(driver)
        db.commit()
        db.refresh(user) # refresh user to hook up back relation
        
    # Generate tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    user_data = {
        "id": str(user.id),
        "fullName": user.fullName,
        "phoneNumber": user.phoneNumber,
        "email": user.email,
        "role": user.role,
    }
    if user.role in ["driver", "helper"] and user.driverProfile:
        user_data["vehicleCategory"] = user.driverProfile.vehicleCategory
        user_data["licensePlate"] = user.driverProfile.licensePlate
        
    return success_response({
        "token": access_token,
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "user": user_data
    })

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    user_data = {
        "id": str(current_user.id),
        "fullName": current_user.fullName,
        "phoneNumber": current_user.phoneNumber,
        "email": current_user.email,
        "role": current_user.role,
    }
    if current_user.role in ["driver", "helper"] and current_user.driverProfile:
        user_data["vehicleCategory"] = current_user.driverProfile.vehicleCategory
        user_data["licensePlate"] = current_user.driverProfile.licensePlate
    return success_response(user_data)

@router.patch("/me")
async def update_me(dto: UpdateProfileRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if dto.fullName is not None:
        current_user.fullName = dto.fullName
        
    if current_user.role in ["driver", "helper"]:
        if current_user.driverProfile:
            if dto.vehicleCategory is not None:
                current_user.driverProfile.vehicleCategory = dto.vehicleCategory
            if dto.licensePlate is not None:
                current_user.driverProfile.licensePlate = dto.licensePlate
        else:
            # Setup new profile if it somehow doesn't exist
            driver = Driver(
                userId=current_user.id,
                vehicleCategory=dto.vehicleCategory or "economy",
                licensePlate=dto.licensePlate,
                status="offline"
            )
            db.add(driver)
            
    db.commit()
    db.refresh(current_user)
    
    user_data = {
        "id": str(current_user.id),
        "fullName": current_user.fullName,
        "phoneNumber": current_user.phoneNumber,
        "email": current_user.email,
        "role": current_user.role,
    }
    if current_user.role in ["driver", "helper"] and current_user.driverProfile:
        user_data["vehicleCategory"] = current_user.driverProfile.vehicleCategory
        user_data["licensePlate"] = current_user.driverProfile.licensePlate
        
    return success_response(user_data)

@router.post("/logout")
async def logout():
    return success_response(message="Logged out successfully")

from fastapi.security import OAuth2PasswordRequestForm
@router.post("/login-swagger")
async def login_swagger(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    phone = form_data.username.strip()
    user = db.query(User).filter(User.phoneNumber == phone).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not registered. Please sign up first."
        )
    
    access_token = create_access_token(user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
