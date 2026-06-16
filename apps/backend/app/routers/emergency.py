from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import math

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import (
    User,
    Incident,
    EmergencyType,
    EmergencySeverity,
    IncidentStatus,
    EmergencyContact,
    EmergencyFacility,
)

router = APIRouter(prefix="/emergency", tags=["emergency"])


# ---------------------------------------------------------------------------
# SOS / Incidents
# ---------------------------------------------------------------------------

class SosRequest(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    w3w: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = EmergencyType.LOST_PERSON.value
    severity: Optional[str] = EmergencySeverity.YELLOW.value
    silent: Optional[bool] = False


def _incident_out(incident: Incident) -> dict:
    return {
        "id": str(incident.id),
        "type": incident.type,
        "severity": incident.severity,
        "status": incident.status,
        "silent": incident.silent,
        "lat": incident.lat,
        "lng": incident.lng,
        "accuracy": incident.accuracy,
        "heading": incident.heading,
        "what3words": incident.what3words,
        "message": incident.message,
        "shareToken": incident.shareToken,
        "createdAt": incident.createdAt.isoformat() if incident.createdAt else None,
        "resolvedAt": incident.resolvedAt.isoformat() if incident.resolvedAt else None,
    }


@router.post("/sos")
async def trigger_sos(
    dto: SosRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid
    import json
    from ..core.redis import get_redis
    from ..core.sio import sio, NAMESPACE

    if dto.type not in [e.value for e in EmergencyType]:
        return error_response("INVALID_TYPE", f"Unknown emergency type: {dto.type}", 422)
    if dto.severity not in [s.value for s in EmergencySeverity]:
        return error_response("INVALID_SEVERITY", f"Unknown severity: {dto.severity}", 422)

    share_token = str(uuid.uuid4())[:8]

    incident = Incident(
        reporterId=current_user.id,
        type=dto.type,
        severity=dto.severity,
        status=IncidentStatus.OPEN,
        silent=dto.silent or False,
        lat=dto.lat,
        lng=dto.lng,
        accuracy=dto.accuracy,
        heading=dto.heading,
        what3words=dto.w3w,
        message=dto.message,
        shareToken=share_token,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # Keep a live-location share session so /location/share/{token} & socket
    # rooms keep working for tracking this incident in real time.
    r = get_redis()
    ttl = 3600
    share_data = {
        "lat": dto.lat,
        "lng": dto.lng,
        "accuracy": dto.accuracy,
        "requestType": dto.type,
        "visibility": "private" if dto.silent else "public",
        "message": dto.message or f"EMERGENCY: {current_user.fullName} needs help",
        "user": {"fullName": current_user.fullName, "phoneNumber": current_user.phoneNumber},
        "incidentId": str(incident.id),
    }
    try:
        r.setex(f"share:{share_token}", ttl, json.dumps(share_data))
    except Exception as e:
        print(f"SOS Redis share write error: {e}")

    # Silent SOS never broadcasts to the visible dispatch room — it only
    # notifies trusted contacts and persists the incident.
    if not dto.silent:
        try:
            await sio.emit(
                "new-request",
                {
                    "id": share_token,
                    "shareCode": share_token,
                    "incidentId": str(incident.id),
                    "pickupLat": dto.lat,
                    "pickupLng": dto.lng,
                    "destinationWhat3words": dto.w3w,
                    "rider": {"fullName": current_user.fullName},
                    "status": "requested",
                    "category": dto.type,
                    "severity": dto.severity,
                    "message": share_data["message"],
                },
                room="dispatch",
                namespace=NAMESPACE,
            )
        except Exception as e:
            print(f"SOS Socket Emission error: {e}")

    # Notify trusted contacts who are also registered Kaalay users; always
    # happens for both silent and visible SOS since this is the whole point
    # of having trusted contacts.
    contacts = db.query(EmergencyContact).filter(EmergencyContact.userId == current_user.id).all()
    notified_user_ids = []
    if contacts:
        from ..models.all import Notification
        contact_phones = [c.phoneNumber for c in contacts]
        matched_users = db.query(User).filter(User.phoneNumber.in_(contact_phones)).all()
        for u in matched_users:
            db.add(Notification(
                userId=u.id,
                title="Emergency Alert",
                message=f"{current_user.fullName} triggered an SOS and needs help.",
                type="emergency",
            ))
            notified_user_ids.append(str(u.id))
        if matched_users:
            db.commit()

    return success_response({
        "incident": _incident_out(incident),
        "token": share_token,
        "shareCode": share_token,
        "contacts": [
            {"name": c.name, "phoneNumber": c.phoneNumber} for c in contacts
        ],
        "notifiedUserIds": notified_user_ids,
        "expiresIn": ttl,
    })


@router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return error_response("NOT_FOUND", "Incident not found", 404)
    if str(incident.reporterId) != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this incident")
    return success_response(_incident_out(incident))


class UpdateIncidentStatusRequest(BaseModel):
    status: str


@router.patch("/incidents/{incident_id}")
async def update_incident_status(
    incident_id: str,
    dto: UpdateIncidentStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if dto.status not in [s.value for s in IncidentStatus]:
        return error_response("INVALID_STATUS", f"Unknown status: {dto.status}", 422)

    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return error_response("NOT_FOUND", "Incident not found", 404)
    if str(incident.reporterId) != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to update this incident")

    from datetime import datetime
    incident.status = dto.status
    if dto.status in (IncidentStatus.RESOLVED.value, IncidentStatus.CANCELLED.value):
        incident.resolvedAt = datetime.utcnow()
        if incident.shareToken:
            try:
                from ..core.redis import get_redis
                from ..core.sio import sio, NAMESPACE
                get_redis().delete(f"share:{incident.shareToken}")
                await sio.emit("request-cancelled", {"shareCode": incident.shareToken, "id": incident.shareToken}, room="dispatch", namespace=NAMESPACE)
            except Exception as e:
                print(f"Incident close socket/redis error: {e}")

    db.commit()
    db.refresh(incident)
    return success_response(_incident_out(incident))


# ---------------------------------------------------------------------------
# Trusted contacts
# ---------------------------------------------------------------------------

class TrustedContactRequest(BaseModel):
    name: str
    phoneNumber: str
    relationship: Optional[str] = None


@router.get("/contacts")
async def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contacts = db.query(EmergencyContact).filter(EmergencyContact.userId == current_user.id).order_by(EmergencyContact.createdAt.asc()).all()
    return success_response([
        {
            "id": str(c.id),
            "name": c.name,
            "phoneNumber": c.phoneNumber,
            "relationship": c.relationship_,
            "createdAt": c.createdAt.isoformat() if c.createdAt else None,
        }
        for c in contacts
    ])


@router.post("/contacts")
async def add_contact(
    dto: TrustedContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_count = db.query(EmergencyContact).filter(EmergencyContact.userId == current_user.id).count()
    if existing_count >= 5:
        return error_response("LIMIT_REACHED", "You can add up to 5 trusted contacts", 422)

    contact = EmergencyContact(
        userId=current_user.id,
        name=dto.name,
        phoneNumber=dto.phoneNumber,
        relationship_=dto.relationship,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return success_response({
        "id": str(contact.id),
        "name": contact.name,
        "phoneNumber": contact.phoneNumber,
        "relationship": contact.relationship_,
    })


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.id == contact_id, EmergencyContact.userId == current_user.id
    ).first()
    if not contact:
        return error_response("NOT_FOUND", "Contact not found", 404)
    db.delete(contact)
    db.commit()
    return success_response({"id": contact_id, "deleted": True})


# ---------------------------------------------------------------------------
# Nearest emergency services
# ---------------------------------------------------------------------------

def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (
        math.sin(dLat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@router.get("/nearest")
async def nearest_facilities(
    lat: float,
    lng: float,
    type: Optional[str] = None,
    limit: int = 5,
    db: Session = Depends(get_db),
):
    query = db.query(EmergencyFacility)
    if type:
        query = query.filter(EmergencyFacility.type == type)
    facilities = query.all()

    scored = sorted(
        (
            {
                "id": str(f.id),
                "name": f.name,
                "type": f.type,
                "lat": f.lat,
                "lng": f.lng,
                "phoneNumber": f.phoneNumber,
                "city": f.city,
                "distanceKm": round(_haversine_km(lat, lng, f.lat, f.lng), 2),
            }
            for f in facilities
        ),
        key=lambda x: x["distanceKm"],
    )
    return success_response(scored[: max(1, limit)])
