from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.websocket import manager
import json

router = APIRouter()

@router.websocket("/loc/{code}")
async def websocket_endpoint(websocket: WebSocket, code: str):
    await manager.connect(websocket, code)
    try:
        while True:
            # Receive JSON data from client
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            event = payload.get("event")
            message = payload.get("data", {})
            
            if event == "push-location":
                # Broadcast location to everyone in the room
                await manager.broadcast({
                    "event": "location",
                    "data": message
                }, code)
                
            elif event == "new-request":
                # Broadcast help request to the global requests room
                await manager.broadcast({
                    "event": "request",
                    "data": {**message, "code": code}
                }, "__requests__")
                
            elif event == "accept-request":
                # Notify the room that request was accepted
                await manager.broadcast({
                    "event": "request-accepted",
                    "data": message
                }, code)

    except WebSocketDisconnect:
        manager.disconnect(websocket, code)
