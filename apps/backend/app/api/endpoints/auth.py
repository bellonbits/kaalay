from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.db.session import get_session
from app.models.base import User, UserRole
from app.core.security import create_access_token
from pydantic import BaseModel
import uuid

router = APIRouter()

class LoginRequest(BaseModel):
    phone_number: str

@router.post("/login")
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_session)
):
    # Logic: Validate phone number, auto-register if not found (matching NestJS behavior)
    query = select(User).where(User.phone_number == payload.phone_number)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if not user:
        # Auto-register
        user = User(
            id=str(uuid.uuid4()),
            phone_number=payload.phone_number,
            role=UserRole.RIDER
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }
