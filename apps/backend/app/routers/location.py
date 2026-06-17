from fastapi import APIRouter, Depends, HTTPException
from ..core.config import settings
from ..core.responses import success_response, error_response
import requests
from pydantic import BaseModel
from typing import List
import uuid

router = APIRouter(prefix="/location", tags=["location"])

def latlng_to_mock_words(lat: float, lng: float) -> str:
    mapping = {'0': 'z', '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '.': 'p', '-': 'm'}
    lat_str = "".join(mapping[c] for c in f"{lat:.5f}" if c in mapping)
    lng_str = "".join(mapping[c] for c in f"{lng:.5f}" if c in mapping)
    return f"{lat_str}.{lng_str}.kaalay"

def mock_words_to_latlng(words: str) -> tuple[float, float]:
    parts = words.strip().replace("///", "").split(".")
    if len(parts) >= 2:
        rev_mapping = {'z': '0', 'a': '1', 'b': '2', 'c': '3', 'd': '4', 'e': '5', 'f': '6', 'g': '7', 'h': '8', 'i': '9', 'p': '.', 'm': '-'}
        try:
            lat = float("".join(rev_mapping[c] for c in parts[0] if c in rev_mapping))
            lng = float("".join(rev_mapping[c] for c in parts[1] if c in rev_mapping))
            return lat, lng
        except:
            pass
    return -1.2921, 36.8219

@router.get("/convert-to-words")
async def convert_to_words(lat: float, lng: float):
    from ..core.redis import get_redis
    import json
    
    lat5 = f"{lat:.5f}"
    lng5 = f"{lng:.5f}"
    redis_key = f"w3w:words:{lat5}:{lng5}"
    
    r = get_redis()
    try:
        cached = r.get(redis_key)
        if cached:
            return success_response(json.loads(cached))
    except Exception as re:
        print(f"Redis cache read error: {re}")
        
    if not settings.W3W_API_KEY or settings.W3W_API_KEY == "Z5Z6G74L":
        success_res = {"words": latlng_to_mock_words(lat, lng), "lat": lat, "lng": lng}
        try:
            r.setex(redis_key, 86400, json.dumps(success_res))
            clean_words = success_res["words"].strip().replace("///", "").lower()
            reverse_res = {
                "latitude": lat,
                "longitude": lng,
                "what3words": success_res["words"]
            }
            r.setex(f"w3w:coords:{clean_words}", 86400, json.dumps(reverse_res))
        except Exception as se:
            print(f"Redis cache write error: {se}")
        return success_response(success_res)
        
    url = f"https://api.what3words.com/v3/convert-to-3wa?coordinates={lat},{lng}&key={settings.W3W_API_KEY}"
    try:
        response = requests.get(url)
        res = response.json()
        if "words" in res:
            success_res = {"words": res["words"], "lat": lat, "lng": lng}
            try:
                # Save both forward and reverse mapping in cache for 24 hours
                r.setex(redis_key, 86400, json.dumps(success_res))
                clean_words = res["words"].strip().replace("///", "").lower()
                reverse_res = {
                    "latitude": lat,
                    "longitude": lng,
                    "what3words": res["words"]
                }
                r.setex(f"w3w:coords:{clean_words}", 86400, json.dumps(reverse_res))
            except Exception as se:
                print(f"Redis cache write error: {se}")
            return success_response(success_res)
        else:
            print(f"W3W Error Response: {res}")
            # Fallback to mock format if quota exceeded or key invalid
            return success_response({"words": latlng_to_mock_words(lat, lng), "lat": lat, "lng": lng, "warning": "quota_exceeded"})
    except Exception as e:
        print(f"W3W Connection Error: {e}")
        return error_response("CONNECTION_ERROR", str(e), 500)

@router.get("/convert-to-coordinates")
async def convert_to_coordinates(words: str):
    from ..core.redis import get_redis
    import json
    
    clean_words = words.strip().replace("///", "").lower()
    redis_key = f"w3w:coords:{clean_words}"
    
    r = get_redis()
    try:
        cached = r.get(redis_key)
        if cached:
            return success_response(json.loads(cached))
    except Exception as re:
        print(f"Redis cache read error: {re}")
        
    if not settings.W3W_API_KEY or settings.W3W_API_KEY == "Z5Z6G74L" or words.endswith(".kaalay"):
        lat, lng = mock_words_to_latlng(words)
        success_res = {
            "latitude": lat,
            "longitude": lng,
            "what3words": words
        }
        try:
            r.setex(redis_key, 86400, json.dumps(success_res))
            lat5 = f"{lat:.5f}"
            lng5 = f"{lng:.5f}"
            forward_res = {"words": words, "lat": lat, "lng": lng}
            r.setex(f"w3w:words:{lat5}:{lng5}", 86400, json.dumps(forward_res))
        except Exception as se:
            print(f"Redis cache write error: {se}")
        return success_response(success_res)
        
    url = f"https://api.what3words.com/v3/convert-to-coordinates?words={words}&key={settings.W3W_API_KEY}"
    try:
        response = requests.get(url)
        res = response.json()
        if "coordinates" in res:
            lat = res["coordinates"]["lat"]
            lng = res["coordinates"]["lng"]
            success_res = {
                "latitude": lat,
                "longitude": lng,
                "what3words": res["words"]
            }
            try:
                # Save both reverse and forward mapping in cache for 24 hours
                r.setex(redis_key, 86400, json.dumps(success_res))
                lat5 = f"{lat:.5f}"
                lng5 = f"{lng:.5f}"
                forward_res = {"words": res["words"], "lat": lat, "lng": lng}
                r.setex(f"w3w:words:{lat5}:{lng5}", 86400, json.dumps(forward_res))
            except Exception as se:
                print(f"Redis cache write error: {se}")
            return success_response(success_res)
        else:
            print(f"W3W Error Response: {res}")
            # Fallback if invalid mock words or error
            lat, lng = mock_words_to_latlng(words)
            return success_response({
                "latitude": lat,
                "longitude": lng,
                "what3words": words,
                "warning": "fallback_triggered"
            })
    except Exception as e:
        print(f"W3W Connection Error: {e}")
        return error_response("CONNECTION_ERROR", str(e), 500)

@router.get("/distance")
async def get_distance(fromLat: float, fromLng: float, toLat: float, toLng: float):
    """Calculate real distance and fare using Haversine formula"""
    import math
    R = 6371  # Earth radius in km
    dLat = math.radians(toLat - fromLat)
    dLng = math.radians(toLng - fromLng)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(fromLat)) * math.cos(math.radians(toLat)) * math.sin(dLng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance_km = round(R * c, 2)
    duration_mins = round((distance_km / 30) * 60)  # ~30km/h avg city speed
    base_fare = 50
    per_km_rate = 40
    estimate = round(base_fare + (per_km_rate * distance_km))
    return success_response({
        "distance": f"{distance_km} km",
        "distanceKm": distance_km,
        "duration": f"{duration_mins} mins",
        "durationMins": duration_mins,
        "estimate": estimate
    })

from typing import Optional

class ShareLocationRequest(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    requestType: Optional[str] = "sharing"
    visibility: Optional[str] = "public"
    message: Optional[str] = None
    expiresAt: Optional[str] = None
    expiresIn: Optional[int] = 600

from fastapi import Request

@router.post("/share")
async def share_location(request: Request):
    from ..core.redis import get_redis
    import json
    
    # RAW DEBUG PRINT
    body = await request.json()
    print(f"DEBUG RECEIVED PAYLOAD: {body}")
    
    # Manually map to DTO to trigger local error if any
    try:
        dto = ShareLocationRequest(**body)
    except Exception as e:
        print(f"MANUAL VALIDATION FAILED: {e}")
        return error_response("VALIDATION_ERROR", str(e), 422)

    r = get_redis()
    token = str(uuid.uuid4())[:8]
    
    # Calculate TTL from expiresAt or expiresIn
    ttl = dto.expiresIn
    if dto.expiresAt:
        from datetime import datetime
        try:
            target = datetime.fromisoformat(dto.expiresAt.replace('Z', '+00:00'))
            now = datetime.now().astimezone()
            ttl = int((target - now).total_seconds())
        except:
            pass

    data = dto.model_dump()
    r.setex(f"share:{token}", max(1, ttl), json.dumps(data))
    
    return success_response({
        "token": token,
        "shareCode": token,
        "shareUrl": f"/share/{token}",
        "expiresIn": ttl
    })

@router.get("/share/{token}")
async def get_shared_location(token: str):
    from ..core.redis import get_redis
    import json
    r = get_redis()
    data = r.get(f"share:{token}")
    if not data:
        return error_response("EXPIRED", "This sharing session has expired", 404)
    
    return success_response(json.loads(data))

from ..core.deps import get_current_user
from ..models.all import User

class SosAlertRequest(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    w3w: str
    message: Optional[str] = None

@router.post("/sos")
async def trigger_sos(
    dto: SosAlertRequest,
    current_user: "User" = Depends(get_current_user)
):
    from ..core.redis import get_redis
    from ..core.sio import sio, NAMESPACE
    import json

    r = get_redis()
    token = str(uuid.uuid4())[:8]

    # SOS session remains active for 1 hour by default (3600 seconds)
    ttl = 3600

    data = {
        "lat": dto.lat,
        "lng": dto.lng,
        "accuracy": dto.accuracy,
        "requestType": "lost",
        "visibility": "public",
        "message": dto.message or f"EMERGENCY: {current_user.fullName} is lost!",
        "user": {
            "fullName": current_user.fullName,
            "phoneNumber": current_user.phoneNumber
        }
    }
    r.setex(f"share:{token}", ttl, json.dumps(data))

    # Emit to Socket.IO dispatch room for active drivers/helpers
    try:
        await sio.emit("new-request", {
            "id": token,
            "shareCode": token,
            "pickupLat": dto.lat,
            "pickupLng": dto.lng,
            "destinationWhat3words": dto.w3w,
            "rider": { "fullName": current_user.fullName },
            "status": "requested",
            "category": "lost",
            "message": dto.message or f"EMERGENCY: {current_user.fullName} is lost!"
        }, room="dispatch", namespace=NAMESPACE)
    except Exception as e:
        print(f"SOS Socket Emission error: {e}")

    return success_response({
        "token": token,
        "shareCode": token,
        "w3w": dto.w3w,
        "lat": dto.lat,
        "lng": dto.lng,
        "expiresIn": ttl
    })

class UpdateShareRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: Optional[str] = None

@router.patch("/share/{token}")
async def update_share_session(token: str, dto: UpdateShareRequest):
    from ..core.redis import get_redis
    import json
    r = get_redis()
    
    key = f"share:{token}"
    ttl = r.ttl(key)
    if ttl <= 0:
        return error_response("EXPIRED", "Session expired", 404)
        
    current_data = json.loads(r.get(key) or "{}")
    
    if dto.status == 'ended':
        r.delete(key)
        # Real-time cancellation broadcasts
        try:
            from ..core.sio import sio, NAMESPACE
            await sio.emit("request-cancelled", {"shareCode": token, "id": token}, room="dispatch", namespace=NAMESPACE)
            await sio.emit("status", {"id": token, "status": "ended"}, room=token, namespace=NAMESPACE)
        except Exception as e:
            print(f"SOS Cancellation Socket error: {e}")
        return success_response({"token": token, "status": "ended"})
        
    if dto.lat is not None and dto.lng is not None:
        current_data["lat"] = dto.lat
        current_data["lng"] = dto.lng
        r.setex(key, ttl, json.dumps(current_data))
        
    return success_response({"token": token, "status": "updated"})

@router.get("/grid")
async def get_grid(sw_lat: float, sw_lng: float, ne_lat: float, ne_lng: float):
    from ..core.redis import get_redis
    import json
    
    # Round bounds to 4 decimal places to normalize keys and guarantee high cache hits
    redis_key = f"w3w:grid:{sw_lat:.4f}:{sw_lng:.4f}:{ne_lat:.4f}:{ne_lng:.4f}"
    
    r = get_redis()
    try:
        cached = r.get(redis_key)
        if cached:
            return success_response(json.loads(cached))
    except Exception as re:
        print(f"Redis cache read error: {re}")
        
    if not settings.W3W_API_KEY or settings.W3W_API_KEY == "Z5Z6G74L":
        return success_response({"type": "FeatureCollection", "features": []})
        
    url = f"https://api.what3words.com/v3/grid-section?bounding-box={sw_lat},{sw_lng},{ne_lat},{ne_lng}&format=geojson&key={settings.W3W_API_KEY}"
    try:
        response = requests.get(url)
        res = response.json()
        try:
            r.setex(redis_key, 300, json.dumps(res))  # 5 min TTL
        except Exception as se:
            print(f"Redis cache write error: {se}")
        return success_response(res)
    except Exception as e:
        return error_response("W3W_GRID_ERROR", str(e), 500)

class SnapToRoadPoint(BaseModel):
    lat: float
    lng: float

class SnapToRoadRequest(BaseModel):
    points: List[SnapToRoadPoint]

@router.post("/snap-to-road")
async def snap_to_road(dto: SnapToRoadRequest):
    """Proxies Google's Roads API so the server-restricted key never reaches
    the client. Returns an empty list on any failure/missing key/no-match —
    callers fall back to raw GPS rather than treat this as a hard error."""
    if not settings.GOOGLE_MAPS_SERVER_KEY or not dto.points:
        return success_response({"snappedPoints": []})

    path = "|".join(f"{p.lat},{p.lng}" for p in dto.points)
    url = (
        f"https://roads.googleapis.com/v1/snapToRoads"
        f"?path={path}&interpolate=true&key={settings.GOOGLE_MAPS_SERVER_KEY}"
    )
    try:
        response = requests.get(url, timeout=5)
        res = response.json()
        snapped = [
            {
                "lat": p["location"]["latitude"],
                "lng": p["location"]["longitude"],
                "placeId": p.get("placeId"),
                "originalIndex": p.get("originalIndex"),
            }
            for p in res.get("snappedPoints", [])
        ]
        return success_response({"snappedPoints": snapped})
    except Exception as e:
        print(f"Roads API Error: {e}")
        return success_response({"snappedPoints": []})

@router.get("/autosuggest")
async def autosuggest(input: str, lat: float = None, lng: float = None):
    if not settings.W3W_API_KEY:
        return success_response({
            "suggestions": [
                {"words": f"{input}.count.soap", "nearestPlace": "Nairobi, Kenya", "country": "KE"},
                {"words": f"{input}.market.tree", "nearestPlace": "Nakuru, Kenya", "country": "KE"}
            ]
        })
        
    url = f"https://api.what3words.com/v3/autosuggest?input={input}&key={settings.W3W_API_KEY}"
    if lat is not None and lng is not None:
        url += f"&focus={lat},{lng}"
    
    try:
        response = requests.get(url)
        return success_response(response.json())
    except Exception as e:
        return error_response("W3W_AUTOSUGGEST_ERROR", str(e), 500)
