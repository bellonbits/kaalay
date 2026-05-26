from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Float, JSON, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum
from ..core.database import Base

class UserRole(str, enum.Enum):
    USER = "user"
    RIDER = "rider"
    DRIVER = "driver"
    ADMIN = "admin"

class RideStatus(str, enum.Enum):
    REQUESTED = "requested"
    ACCEPTED = "accepted"
    ARRIVING = "arriving"
    ARRIVED = "arrived"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class DriverStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"

class RideCategory(str, enum.Enum):
    ECONOMY = "economy"
    BIKE = "bike"
    XL = "xl"
    DELIVERY = "delivery"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fullName = Column(String)
    phoneNumber = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashedPassword = Column(String)
    role = Column(String, default=UserRole.RIDER)
    isActive = Column(Boolean, default=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rides = relationship("Ride", back_populates="rider")
    driverProfile = relationship("Driver", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")

class Driver(Base):
    __tablename__ = "drivers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    userId = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    vehicleModel = Column(String, nullable=True)
    vehicleColor = Column(String, nullable=True)
    licensePlate = Column(String, nullable=True)
    vehicleCategory = Column(String, default=RideCategory.ECONOMY)
    nationalIdUrl = Column(String, nullable=True)
    drivingLicenseUrl = Column(String, nullable=True)
    isVerified = Column(Boolean, default=False)
    status = Column(String, default=DriverStatus.OFFLINE)
    rating = Column(Float, default=0.0)
    acceptanceRate = Column(Float, default=1.0)
    currentLat = Column(Float, nullable=True)
    currentLng = Column(Float, nullable=True)
    lastSeen = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="driverProfile")
    rides = relationship("Ride", back_populates="driver")
    ratings = relationship("Rating", back_populates="driver")

class Ride(Base):
    __tablename__ = "rides"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    riderId = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    driverId = Column(UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=True)
    status = Column(String, default=RideStatus.REQUESTED)
    category = Column(String, default=RideCategory.ECONOMY)
    
    pickupLat = Column(Float)
    pickupLng = Column(Float)
    pickupWhat3words = Column(String)
    
    destinationLat = Column(Float)
    destinationLng = Column(Float)
    destinationWhat3words = Column(String)
    
    fare = Column(Float, nullable=True)
    distance = Column(Float, nullable=True)
    duration = Column(Float, nullable=True)
    
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rider = relationship("User", back_populates="rides")
    driver = relationship("Driver", back_populates="rides")

class Place(Base):
    __tablename__ = "places"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    description = Column(String, nullable=True)
    latitude = Column(Float)
    longitude = Column(Float)
    words = Column(String, index=True)
    tags = Column(JSON, default=[])
    photos = Column(JSON, default=[])
    createdAt = Column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    userId = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String)
    message = Column(String)
    type = Column(String, default="info")
    read = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rideId = Column(UUID(as_uuid=True), ForeignKey("rides.id"), unique=True)
    amount = Column(Float)
    status = Column(String, default="pending") # pending, success, failed
    provider = Column(String, default="cash")
    transactionId = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    ride = relationship("Ride")

class Rating(Base):
    __tablename__ = "ratings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rideId = Column(UUID(as_uuid=True), ForeignKey("rides.id"), unique=True)
    riderId = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    driverId = Column(UUID(as_uuid=True), ForeignKey("drivers.id"))
    rating = Column(Integer)
    comment = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    driver = relationship("Driver", back_populates="ratings")
