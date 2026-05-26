from enum import Enum
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class UserRole(str, Enum):
    USER = "user"
    HELPER = "helper"
    DRIVER = "driver"
    ADMIN = "admin"
    RIDER = "rider"

class UserBase(SQLModel):
    phone_number: str = Field(unique=True, index=True)
    full_name: Optional[str] = None
    role: UserRole = Field(default=UserRole.RIDER)
    is_active: bool = Field(default=True)

class User(UserBase, table=True):
    __tablename__ = "users"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    rides: List["Ride"] = Relationship(back_populates="rider")

class RideBase(SQLModel):
    status: str = Field(default="pending")
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    price: Optional[float] = None

class Ride(RideBase, table=True):
    __tablename__ = "rides"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    rider_id: str = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    rider: User = Relationship(back_populates="rides")
