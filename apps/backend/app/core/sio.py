import socketio
import logging
from typing import Any

# Silence the PING/PONG spam in python logger
logging.getLogger('socketio').setLevel(logging.WARNING)
logging.getLogger('engineio').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Initialize Socket.io Async Server with optimized settings
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    ping_timeout=20,
    ping_interval=25,
    max_http_buffer_size=1_000_000,
    logger=False,
    engineio_logger=False
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

@sio.on("join-group", namespace=NAMESPACE)
async def handle_join_group(sid, data):
    code = data.get("code")
    member_id = data.get("memberId")
    name = data.get("name")
    
    if not code or not member_id:
        return
        
    room = f"group:{code}"
    await sio.enter_room(sid, room, namespace=NAMESPACE)
    
    r = get_redis()
    import json
    import time
    
    member_data = {
        "memberId": member_id,
        "name": name,
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "accuracy": data.get("accuracy"),
        "heading": data.get("heading"),
        "lastSeen": int(time.time() * 1000)
    }
    
    host_id = r.get(f"group:{code}:host")
    if host_id == member_id:
        member_data["isHost"] = True
        
    r.hset(f"group:{code}:members", member_id, json.dumps(member_data))
    
    all_members_raw = r.hgetall(f"group:{code}:members")
    all_members = []
    for m_id, m_raw in all_members_raw.items():
        all_members.append(json.loads(m_raw))
        
    await sio.emit("member-list", all_members, to=sid, namespace=NAMESPACE)
    await sio.emit("member-joined", member_data, room=room, skip_sid=sid, namespace=NAMESPACE)
    logger.info(f"Group Member {name} joined session {code}")

@sio.on("leave-group", namespace=NAMESPACE)
async def handle_leave_group(sid, data):
    code = data.get("code")
    member_id = data.get("memberId")
    
    if not code or not member_id:
        return
        
    room = f"group:{code}"
    await sio.leave_room(sid, room, namespace=NAMESPACE)
    
    r = get_redis()
    r.hdel(f"group:{code}:members", member_id)
    
    host_id = r.get(f"group:{code}:host")
    if host_id == member_id:
        r.delete(f"group:{code}:host")
        
    await sio.emit("member-left", {"memberId": member_id}, room=room, namespace=NAMESPACE)
    logger.info(f"Group Member {member_id} left session {code}")

@sio.on("group-location", namespace=NAMESPACE)
async def handle_group_location(sid, data):
    code = data.get("code")
    member_id = data.get("memberId")
    
    if not code or not member_id:
        return
        
    room = f"group:{code}"
    r = get_redis()
    import json
    import time
    
    member_raw = r.hget(f"group:{code}:members", member_id)
    if member_raw:
        member = json.loads(member_raw)
        member["lat"] = data.get("lat")
        member["lng"] = data.get("lng")
        member["accuracy"] = data.get("accuracy")
        member["heading"] = data.get("heading")
        member["lastSeen"] = int(time.time() * 1000)
        r.hset(f"group:{code}:members", member_id, json.dumps(member))
        
    update_data = {
        "memberId": member_id,
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "accuracy": data.get("accuracy"),
        "heading": data.get("heading")
    }
    await sio.emit("member-location", update_data, room=room, skip_sid=sid, namespace=NAMESPACE)

@sio.on("host-location", namespace=NAMESPACE)
async def handle_host_location(sid, data):
    code = data.get("code")
    member_id = data.get("memberId")
    
    if not code or not member_id:
        return
        
    room = f"group:{code}"
    host_moved_data = {
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "accuracy": data.get("accuracy"),
        "heading": data.get("heading")
    }
    await sio.emit("host-moved", host_moved_data, room=room, skip_sid=sid, namespace=NAMESPACE)

@sio.on("set-host", namespace=NAMESPACE)
async def handle_set_host(sid, data):
    code = data.get("code")
    member_id = data.get("memberId")
    name = data.get("name")
    
    if not code or not member_id:
        return
        
    room = f"group:{code}"
    r = get_redis()
    import json
    
    r.set(f"group:{code}:host", member_id)
    
    all_members_raw = r.hgetall(f"group:{code}:members")
    for m_id, m_raw in all_members_raw.items():
        member = json.loads(m_raw)
        if m_id == member_id:
            member["isHost"] = True
        else:
            member["isHost"] = False
        r.hset(f"group:{code}:members", m_id, json.dumps(member))
        
    await sio.emit("host-changed", {"hostId": member_id, "name": name}, room=room, namespace=NAMESPACE)
    logger.info(f"Host changed in session {code} to {name}")

@sio.on("push-location", namespace=NAMESPACE)
async def handle_push_location(sid, data):
    room = data.get("code")
    if room:
        await sio.emit("location", data, room=room, namespace=NAMESPACE)

@sio.on("viewer-location", namespace=NAMESPACE)
async def handle_viewer_location(sid, data):
    room = data.get("code")
    if room:
        await sio.emit("viewer-location", data, room=room, namespace=NAMESPACE)

@sio.on("accept-request", namespace=NAMESPACE)
async def handle_accept(sid, data):
    room = data.get("code")
    if room:
        await sio.emit("request-accepted", data, room=room, namespace=NAMESPACE)
        await sio.emit("request-claimed", {"shareCode": room}, room="dispatch", namespace=NAMESPACE)

@sio.on("arrived", namespace=NAMESPACE)
async def handle_arrival(sid, data):
    room = data.get("code")
    name = data.get("name")
    if room:
        import time
        arrival_data = {
            "name": name,
            "timestamp": int(time.time() * 1000)
        }
        await sio.emit("member-arrived", arrival_data, room=room, namespace=NAMESPACE)

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
