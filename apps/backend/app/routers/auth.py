from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from ..core.database import get_db
from ..core.security import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    decode_token
)
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import User
from pydantic import BaseModel, EmailStr
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])

class UserResponse(BaseModel):
    id: uuid.UUID
    fullName: str
    phoneNumber: str
    email: Optional[str]
    role: str

class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: UserResponse

class RegisterRequest(BaseModel):
    fullName: str
    phoneNumber: str
    email: Optional[EmailStr] = None
    password: str
    role: str = "rider"

class LoginRequest(BaseModel):
    phoneNumber: str # Can be phone or email
    password: str

@router.post("/register", response_model=None)
async def register(dto: RegisterRequest, db: Session = Depends(get_db)):
    # Check for existing user by phone or email
    existing = db.query(User).filter(
        (User.phoneNumber == dto.phoneNumber) | 
        (User.email == dto.email if dto.email else False)
    ).first()
    
    if existing:
        return error_response("CONFLICT", "Phone number or email already registered", 409)
    
    user = User(
        fullName=dto.fullName,
        phoneNumber=dto.phoneNumber,
        email=dto.email,
        hashedPassword=get_password_hash(dto.password),
        role=dto.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return success_response({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "user": user
    })

@router.post("/login")
async def login(dto: LoginRequest, db: Session = Depends(get_db)):
    # Support both phone and email login
    user = db.query(User).filter(
        (User.phoneNumber == dto.phoneNumber) | (User.email == dto.phoneNumber)
    ).first()
    
    if not user or not verify_password(dto.password, user.hashedPassword):
        return error_response("UNAUTHORIZED", "Invalid phone/email or password", 401)
    
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return success_response({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "user": user
    })

@router.post("/refresh-token")
async def refresh_token(refreshToken: str, db: Session = Depends(get_db)):
    payload = decode_token(refreshToken)
    if not payload or payload.get("type") != "refresh":
        return error_response("INVALID_TOKEN", "Invalid refresh token", 401)
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return error_response("NOT_FOUND", "User not found", 404)
        
    new_access = create_access_token(user.id)
    return success_response({"accessToken": new_access})

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return success_response(current_user)

@router.post("/logout")
async def logout():
    # In JWT stateless auth, logout is handled by the client clearing the token.
    # We could implement a blacklist in Redis here if needed.
    return success_response(message="Logged out successfully")
