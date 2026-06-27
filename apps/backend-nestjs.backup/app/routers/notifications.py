from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.responses import success_response, error_response
from ..models.all import Notification, User
import uuid

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifications = (
        db.query(Notification)
        .filter(Notification.userId == current_user.id)
        .order_by(Notification.createdAt.desc())
        .limit(50)
        .all()
    )
    return success_response([{
        "id": str(n.id),
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "read": n.read,
        "createdAt": n.createdAt.isoformat() if n.createdAt else None,
    } for n in notifications])

@router.patch("/{id}/read")
async def mark_read(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(
        Notification.id == id,
        Notification.userId == current_user.id
    ).first()
    if not notif:
        return error_response("NOT_FOUND", "Notification not found", 404)
    notif.read = True
    db.commit()
    return success_response({"success": True})

@router.delete("/{id}")
async def delete_notification(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(
        Notification.id == id,
        Notification.userId == current_user.id
    ).first()
    if not notif:
        return error_response("NOT_FOUND", "Notification not found", 404)
    db.delete(notif)
    db.commit()
    return success_response({"success": True})
