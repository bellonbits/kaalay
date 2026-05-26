import socketio
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Initialize Socket.io Async Server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

# ASGI App to mount in FastAPI
sio_app = socketio.ASGIApp(sio)

# All events are on the '/loc' namespace as required by the frontend
NAMESPACE = "/loc"

@sio.event(namespace=NAMESPACE)
async def connect(sid, environ):
    logger.info(f"SIO connected to {NAMESPACE}: {sid}")

@sio.event(namespace=NAMESPACE)
async def disconnect(sid):
    logger.info(f"SIO disconnected from {NAMESPACE}: {sid}")

@sio.on("join", namespace=NAMESPACE)
async def handle_join(sid, room):
    await sio.enter_room(sid, room, namespace=NAMESPACE)
    logger.info(f"SIO {sid} joined room: {room} in {NAMESPACE}")
    # Update viewer count
    participants = sio.manager.get_participants(NAMESPACE, room)
    count = len(list(participants))
    await sio.emit("viewer-count", {"count": count}, room=room, namespace=NAMESPACE)

@sio.on("leave", namespace=NAMESPACE)
async def handle_leave(sid, room):
    await sio.leave_room(sid, room, namespace=NAMESPACE)
    logger.info(f"SIO {sid} left room: {room} in {NAMESPACE}")
    # Update viewer count
    participants = sio.manager.get_participants(NAMESPACE, room)
    count = len(list(participants))
    await sio.emit("viewer-count", {"count": count}, room=room, namespace=NAMESPACE)

@sio.on("push-location", namespace=NAMESPACE)
async def handle_push_location(sid, data):
    # data: { code, lat, lng, accuracy, heading, timestamp }
    room = data.get("code")
    if room:
        await sio.emit("location", data, room=room, namespace=NAMESPACE)

@sio.on("viewer-location", namespace=NAMESPACE)
async def handle_viewer_location(sid, data):
    # data: { code, viewerId, name, lat, lng, accuracy }
    room = data.get("code")
    if room:
        await sio.emit("viewer-location", data, room=room, namespace=NAMESPACE)

@sio.on("accept-request", namespace=NAMESPACE)
async def handle_accept(sid, data):
    # data: { code, helperName, helperId }
    room = data.get("code")
    if room:
        await sio.emit("request-accepted", data, room=room, namespace=NAMESPACE)
        # Global notification to clear this from other drivers' screens
        await sio.emit("request-claimed", {"shareCode": room}, room="dispatch", namespace=NAMESPACE)

@sio.on("arrived", namespace=NAMESPACE)
async def handle_arrival(sid, data):
    # data: { code, name }
    room = data.get("code")
    if room:
        await sio.emit("member-arrived", data, room=room, namespace=NAMESPACE)

@sio.on("go-online", namespace=NAMESPACE)
async def handle_go_online(sid, data=None):
    # Driver joins global dispatch room AND their private ID room
    await sio.enter_room(sid, "dispatch", namespace=NAMESPACE)
    if data and data.get("driverId"):
        driver_id = data.get("driverId")
        await sio.enter_room(sid, str(driver_id), namespace=NAMESPACE)
        logger.info(f"Driver {driver_id} is now ONLINE and joined private room")
    else:
        logger.info(f"Driver {sid} is now ONLINE for global dispatch")

@sio.on("go-offline", namespace=NAMESPACE)
async def handle_go_offline(sid, data=None):
    await sio.leave_room(sid, "dispatch", namespace=NAMESPACE)
    if data and data.get("driverId"):
        await sio.leave_room(sid, str(data.get("driverId")), namespace=NAMESPACE)
    logger.info(f"Driver {sid} is now OFFLINE")

@sio.on("broadcast-request", namespace=NAMESPACE)
async def handle_broadcast_request(sid, data):
    # data: { shareCode, lat, lng, type, message, fullName }
    logger.info(f"Broadcasting NEW REQUEST {data.get('shareCode')} to dispatch room")
    await sio.emit("new-request", data, room="dispatch", namespace=NAMESPACE)

@sio.on("update-location", namespace=NAMESPACE)
async def handle_update_location(sid, data):
    # data: { lat, lng, driverId, name }
    lat = data.get("lat")
    lng = data.get("lng")
    driver_id = data.get("driverId")
    
    if lat and lng and driver_id:
        try:
            from .kafka import produce_location_update
            await produce_location_update({
                "lat": lat,
                "lng": lng,
                "driverId": driver_id,
                "name": data.get("name")
            })
        except Exception as e:
            logger.error(f"Kafka produce error: {e}")


@sio.on("status-update", namespace=NAMESPACE)
async def handle_status_update(sid, data):
    # data: { code, status }
    room = data.get("code")
    if room:
        await sio.emit("status", data, room=room, namespace=NAMESPACE)
