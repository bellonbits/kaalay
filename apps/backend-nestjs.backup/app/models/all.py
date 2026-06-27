from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Float, JSON, Integer, UniqueConstraint
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
    EMERGENCY_OPERATOR = "emergency_operator"

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
    MOTORCYCLE = "motorcycle"
    XL = "xl"
    DELIVERY = "delivery"
    BIKE = "bike"

class EmergencyType(str, enum.Enum):
    MEDICAL = "medical"
    POLICE = "police"
    VIOLENCE = "violence"
    KIDNAPPING = "kidnapping"
    FIRE = "fire"
    DISASTER = "disaster"
    LOST_PERSON = "lost_person"

class EmergencySeverity(str, enum.Enum):
    GREEN = "green"
    YELLOW = "yellow"
    ORANGE = "orange"
    RED = "red"
    BLACK = "black"

class IncidentStatus(str, enum.Enum):
    OPEN = "open"
    DISPATCHED = "dispatched"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"

class FacilityType(str, enum.Enum):
    HOSPITAL = "hospital"
    CLINIC = "clinic"
    POLICE = "police"
    FIRE = "fire"
    AMBULANCE = "ambulance"

class RoadReportType(str, enum.Enum):
    BLOCKED = "blocked"
    FLOODED = "flooded"
    CONSTRUCTION = "construction"
    ACCIDENT = "accident"
    OTHER = "other"

class RoadReportStatus(str, enum.Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"

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
    emergencyContacts = relationship("EmergencyContact", back_populates="owner", foreign_keys="EmergencyContact.userId")
    incidents = relationship("Incident", back_populates="reporter")

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

class Message(Base):
    """Rider<->driver chat, scoped to a single ride. One per text bubble."""
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rideId = Column(UUID(as_uuid=True), ForeignKey("rides.id"))
    senderId = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    text = Column(String)
    createdAt = Column(DateTime, default=datetime.utcnow)

    ride = relationship("Ride")
    sender = relationship("User")

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
    # Opening hours — kept intentionally simple (one daily window, not a
    # full per-weekday schedule) since these are community-contributed
    # spots, not managed business listings.
    alwaysOpen = Column(Boolean, default=True)
    openTime = Column(String, nullable=True)   # "HH:MM", 24h, local time
    closeTime = Column(String, nullable=True)  # "HH:MM", 24h, local time
    visitCount = Column(Integer, default=0)
    createdBy = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
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

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    userId = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String)
    phoneNumber = Column(String)
    relationship_ = Column("relationship", String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="emergencyContacts", foreign_keys=[userId])

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporterId = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    type = Column(String, default=EmergencyType.LOST_PERSON)
    severity = Column(String, default=EmergencySeverity.YELLOW)
    status = Column(String, default=IncidentStatus.OPEN)
    silent = Column(Boolean, default=False)

    lat = Column(Float)
    lng = Column(Float)
    accuracy = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    what3words = Column(String, nullable=True)
    message = Column(String, nullable=True)
    shareToken = Column(String, nullable=True, index=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolvedAt = Column(DateTime, nullable=True)

    reporter = relationship("User", back_populates="incidents")

class EmergencyFacility(Base):
    __tablename__ = "emergency_facilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    type = Column(String, default=FacilityType.HOSPITAL)
    lat = Column(Float)
    lng = Column(Float)
    phoneNumber = Column(String, nullable=True)
    city = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

class PlaceReview(Base):
    __tablename__ = "place_reviews"
    __table_args__ = (UniqueConstraint("placeId", "userId", name="uq_place_review_user"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    placeId = Column(UUID(as_uuid=True), ForeignKey("places.id"))
    userId = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    rating = Column(Integer)  # 1-5
    comment = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    place = relationship("Place")
    user = relationship("User")

class PlaceNote(Base):
    """Community-contributed directions for the last metres a map can't get
    right — "after the petrol station turn left", "blue gate beside the
    school". This is Kaalay's actual differentiator over Google Maps."""
    __tablename__ = "place_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    placeId = Column(UUID(as_uuid=True), ForeignKey("places.id"))
    userId = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    text = Column(String)
    # "general" | "entrance" | "floor" | "room" | "landmark" — lets the last
    # stretch of guidance for interior/private destinations (which gate,
    # which floor, which room) be grouped distinctly instead of one flat
    # list. Free string, not a DB enum, matching every other "kind"-style
    # field in this codebase (RideCategory etc. are validated app-side).
    kind = Column(String, default="general")
    createdAt = Column(DateTime, default=datetime.utcnow)

    place = relationship("Place")
    user = relationship("User")

class LocalGuide(Base):
    """A community-shared route — e.g. a walking shortcut through an estate
    or the matatu route to a market — distinct from a Ride: no driver, no
    fare, just a path someone else found useful."""
    __tablename__ = "local_guides"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)  # e.g. "walking shortcut", "matatu route"
    createdBy = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    startLat = Column(Float)
    startLng = Column(Float)
    endLat = Column(Float)
    endLng = Column(Float)
    waypoints = Column(JSON, default=[])  # [{lat, lng}, ...] in order, including start/end
    distanceKm = Column(Float, nullable=True)
    timesUsed = Column(Integer, default=0)

    createdAt = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User")

class RoadReport(Base):
    __tablename__ = "road_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporterId = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    type = Column(String, default=RoadReportType.OTHER)
    lat = Column(Float)
    lng = Column(Float)
    description = Column(String, nullable=True)
    status = Column(String, default=RoadReportStatus.ACTIVE)

    createdAt = Column(DateTime, default=datetime.utcnow)
    resolvedAt = Column(DateTime, nullable=True)

    reporter = relationship("User")
