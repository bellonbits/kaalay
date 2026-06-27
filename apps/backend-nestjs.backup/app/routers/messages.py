from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Message, Ride, RideStatus, User
import uuid

router = APIRouter(prefix="/rides", tags=["messages"])

# Chat is only available once a driver is actually on the trip — before
# acceptance there's no one to message, and after completion/cancellation
# the thread is closed.
ACTIVE_STATUSES = {RideStatus.ACCEPTED, RideStatus.ARRIVING, RideStatus.ARRIVED, RideStatus.STARTED}


def _message_out(m: Message) -> dict:
    return {
        "id": str(m.id),
        "rideId": str(m.rideId),
        "senderId": str(m.senderId),
        "senderName": m.sender.fullName if m.sender else None,
        "text": m.text,
        "createdAt": m.createdAt.isoformat() if m.createdAt else None,
    }


def _has_access(ride: Ride, user: User) -> bool:
    if str(ride.riderId) == str(user.id):
        return True
    if ride.driver and str(ride.driver.userId) == str(user.id):
        return True
    return False


class MessageCreate(BaseModel):
    text: str


@router.get("/{id}/messages")
async def get_messages(id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ride = db.query(Ride).options(joinedload(Ride.driver)).filter(Ride.id == id).first()
    if not ride:
        return error_response("NOT_FOUND", "Ride not found", 404)
    if not _has_access(ride, current_user):
        return error_response("FORBIDDEN", "You're not part of this ride", 403)
    messages = db.query(Message).filter(Message.rideId == id).order_by(Message.createdAt.asc()).all()
    return success_response([_message_out(m) for m in messages])


@router.post("/{id}/messages")
async def create_message(
    id: uuid.UUID, dto: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ride = db.query(Ride).options(joinedload(Ride.driver)).filter(Ride.id == id).first()
    if not ride:
        return error_response("NOT_FOUND", "Ride not found", 404)
    if not _has_access(ride, current_user):
        return error_response("FORBIDDEN", "You're not part of this ride", 403)
    if ride.status not in ACTIVE_STATUSES:
        return error_response("RIDE_NOT_ACTIVE", "Chat is only available once a driver has accepted", 400)

    text = dto.text.strip()
    if not text:
        return error_response("EMPTY_MESSAGE", "Message can't be empty", 400)

    message = Message(rideId=id, senderId=current_user.id, text=text)
    db.add(message)
    db.commit()
    db.refresh(message)

    payload = _message_out(message)
    try:
        from ..core.sio import sio, NAMESPACE
        await sio.emit("chat-message", payload, room=str(id), namespace=NAMESPACE)
    except Exception as e:
        print(f"Chat socket emit error: {e}")

    return success_response(payload)
