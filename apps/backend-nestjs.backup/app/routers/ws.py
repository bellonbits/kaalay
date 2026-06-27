from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["websockets"])

class ConnectionManager:
    def __init__(self):
        # Maps a key (e.g., "driver:uuid" or "ride:uuid") to a list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, key: str, websocket: WebSocket):
        await websocket.accept()
        if key not in self.active_connections:
            self.active_connections[key] = []
        self.active_connections[key].append(websocket)
        logger.info(f"Connected: {key}. Total active: {len(self.active_connections[key])}")

    def disconnect(self, key: str, websocket: WebSocket):
        if key in self.active_connections:
            self.active_connections[key].remove(websocket)
            if not self.active_connections[key]:
                del self.active_connections[key]
        logger.info(f"Disconnected: {key}")

    async def broadcast(self, message: dict, key: str):
        if key in self.active_connections:
            for connection in self.active_connections[key]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to {key}: {e}")

manager = ConnectionManager()

@router.websocket("/drivers/{driver_id}")
async def driver_socket(websocket: WebSocket, driver_id: str):
    """
    Handle real-time location updates from drivers.
    Updates are stored in Redis (GEO) for proximity matching.
    """
    await manager.connect(f"driver:{driver_id}", websocket)
    from ..core.redis import get_redis
    r = get_redis()
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                lat = msg.get("lat")
                lng = msg.get("lng")
                
                if lat and lng:
                    # Sync with Redis GEO for dispatching
                    r.geoadd("driver_locations", (lng, lat, driver_id))
                    # Also update driver's last known location in ride sessions if applicable
                    
                await websocket.send_json({"type": "location_ack", "status": "synced"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(f"driver:{driver_id}", websocket)

@router.websocket("/rides/{ride_id}")
async def ride_socket(websocket: WebSocket, ride_id: str):
    """
    Riders and drivers can join this channel to see live updates for a specific ride.
    """
    await manager.connect(f"ride:{ride_id}", websocket)
    try:
        while True:
            await websocket.receive_text() # Keep-alive loop
    except WebSocketDisconnect:
        manager.disconnect(f"ride:{ride_id}", websocket)

# Global utility to send events to specific rooms from other routers
async def notify_ride_update(ride_id: str, message: dict):
    await manager.broadcast(message, f"ride:{ride_id}")

async def notify_driver(driver_id: str, message: dict):
    await manager.broadcast(message, f"driver:{driver_id}")
