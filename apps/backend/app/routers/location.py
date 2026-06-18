from fastapi import APIRouter, Depends, HTTPException
from ..core.config import settings
from ..core.responses import success_response, error_response
import requests
from pydantic import BaseModel
from typing import List
import uuid

router = APIRouter(prefix="/location", tags=["location"])

# ── Kaalay location codes ───────────────────────────────────────────────
# Customer-facing location codes are entirely our own — never the real
# what3words product. Format: "{COUNTY}-{8-char base36}", e.g. "NRB-4K9PX2W8".
# The county prefix is just a nearest-centroid label for readability; the
# suffix is a reversible encoding of lat/lng within Kenya's bounding box, so
# no database/lookup table is needed to go either direction.
#
# County centroids are approximate (general knowledge, not surveyed
# boundaries) — good enough for a friendly regional tag, not for legal
# boundary determination.
KENYA_COUNTIES = [
    ("Mombasa", "MSA", -4.05, 39.67), ("Kwale", "KWL", -4.18, 39.45),
    ("Kilifi", "KLF", -3.51, 39.85), ("Tana River", "TRV", -1.65, 40.10),
    ("Lamu", "LMU", -2.27, 40.90), ("Taita-Taveta", "TTV", -3.40, 38.35),
    ("Garissa", "GRS", -0.45, 39.65), ("Wajir", "WJR", 1.75, 40.05),
    ("Mandera", "MDR", 3.93, 41.86), ("Marsabit", "MSB", 2.33, 37.98),
    ("Isiolo", "ISL", 0.35, 37.58), ("Meru", "MRU", 0.05, 37.65),
    ("Tharaka-Nithi", "THN", -0.30, 37.75), ("Embu", "EMB", -0.54, 37.46),
    ("Kitui", "KTU", -1.37, 38.01), ("Machakos", "MCK", -1.52, 37.27),
    ("Makueni", "MKN", -2.25, 37.83), ("Nyandarua", "NYD", -0.18, 36.52),
    ("Nyeri", "NYR", -0.42, 36.95), ("Kirinyaga", "KRG", -0.66, 37.32),
    ("Murang'a", "MRG", -0.78, 37.04), ("Kiambu", "KMB", -1.03, 36.87),
    ("Turkana", "TKN", 3.12, 35.60), ("West Pokot", "WPK", 1.62, 35.39),
    ("Samburu", "SMB", 1.22, 36.96), ("Trans Nzoia", "TNZ", 1.05, 34.95),
    ("Uasin Gishu", "UGS", 0.52, 35.30), ("Elgeyo-Marakwet", "EGM", 0.80, 35.50),
    ("Nandi", "NND", 0.18, 35.13), ("Baringo", "BRG", 0.47, 35.97),
    ("Laikipia", "LKP", 0.20, 36.78), ("Nakuru", "NKU", -0.30, 36.07),
    ("Narok", "NRK", -1.08, 35.87), ("Kajiado", "KJD", -2.10, 36.78),
    ("Kericho", "KRC", -0.37, 35.29), ("Bomet", "BMT", -0.78, 35.34),
    ("Kakamega", "KKG", 0.28, 34.75), ("Vihiga", "VHG", 0.05, 34.72),
    ("Bungoma", "BNG", 0.56, 34.56), ("Busia", "BSA", 0.46, 34.11),
    ("Siaya", "SYA", 0.06, 34.29), ("Kisumu", "KSM", -0.09, 34.77),
    ("Homa Bay", "HBY", -0.53, 34.46), ("Migori", "MGR", -1.06, 34.47),
    ("Kisii", "KSI", -0.68, 34.78), ("Nyamira", "NYM", -0.57, 34.94),
    ("Nairobi", "NRB", -1.29, 36.82),
]

_BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_CODE_WIDTH = 8
# Generous bounding box around Kenya (not a tight crop) so border towns
# still encode/decode correctly.
_LAT_MIN, _LAT_MAX = -4.9, 5.1
_LNG_MIN, _LNG_MAX = 33.8, 42.0
_SCALE = 100000  # ~1.1m steps — finer than what3words' 3m squares
_LNG_SPAN = int(round((_LNG_MAX - _LNG_MIN) * _SCALE)) + 1

def _nearest_county_abbr(lat: float, lng: float) -> str:
    best = min(KENYA_COUNTIES, key=lambda c: (c[2] - lat) ** 2 + (c[3] - lng) ** 2)
    return best[1]

def _to_base36(n: int) -> str:
    if n == 0:
        digits = "0"
    else:
        chars = []
        while n > 0:
            n, r = divmod(n, 36)
            chars.append(_BASE36[r])
        digits = "".join(reversed(chars))
    return digits.rjust(_CODE_WIDTH, "0")

def _from_base36(s: str) -> int:
    n = 0
    for ch in s.upper():
        n = n * 36 + _BASE36.index(ch)
    return n

def latlng_to_kaalay_code(lat: float, lng: float) -> str:
    abbr = _nearest_county_abbr(lat, lng)
    clamped_lat = min(max(lat, _LAT_MIN), _LAT_MAX)
    clamped_lng = min(max(lng, _LNG_MIN), _LNG_MAX)
    lat_int = int(round((clamped_lat - _LAT_MIN) * _SCALE))
    lng_int = int(round((clamped_lng - _LNG_MIN) * _SCALE))
    combined = lat_int * _LNG_SPAN + lng_int
    return f"{abbr}-{_to_base36(combined)}"

def kaalay_code_to_latlng(code: str) -> tuple[float, float]:
    try:
        _, suffix = code.strip().upper().replace("///", "").split("-", 1)
        combined = _from_base36(suffix)
        lat_int, lng_int = divmod(combined, _LNG_SPAN)
        lat = lat_int / _SCALE + _LAT_MIN
        lng = lng_int / _SCALE + _LNG_MIN
        return lat, lng
    except (ValueError, IndexError):
        return -1.2921, 36.8219  # Nairobi fallback for unrecognized input

def _lookup_real_what3words(lat: float, lng: float) -> None:
    """Fires the real what3words API and stashes the result server-side
    (Redis, internal-only key) for our own reference — never returned to
    the frontend. Customers only ever see the Kaalay code. Best-effort:
    any failure here is swallowed, it must never affect the customer-facing
    response."""
    if not settings.W3W_API_KEY or settings.W3W_API_KEY == "Z5Z6G74L":
        return
    try:
        from ..core.redis import get_redis
        import json
        response = requests.get(
            f"https://api.what3words.com/v3/convert-to-3wa?coordinates={lat},{lng}&key={settings.W3W_API_KEY}",
            timeout=5,
        )
        res = response.json()
        real_words = res.get("words")
        if real_words:
            r = get_redis()
            r.setex(f"internal:w3w:{lat:.5f}:{lng:.5f}", 86400, json.dumps({"words": real_words}))
    except Exception as e:
        print(f"Internal what3words lookup error (non-fatal): {e}")

@router.get("/convert-to-words")
async def convert_to_words(lat: float, lng: float):
    from ..core.redis import get_redis
    import json

    lat5 = f"{lat:.5f}"
    lng5 = f"{lng:.5f}"
    redis_key = f"kcode:words:{lat5}:{lng5}"

    r = get_redis()
    try:
        cached = r.get(redis_key)
        if cached:
            return success_response(json.loads(cached))
    except Exception as re:
        print(f"Redis cache read error: {re}")

    # Real what3words lookup happens server-side only, for our own internal
    # reference — the customer-facing "words" field below is always our own
    # Kaalay code, never the real what3words address.
    _lookup_real_what3words(lat, lng)

    code = latlng_to_kaalay_code(lat, lng)
    success_res = {"words": code, "lat": lat, "lng": lng}
    try:
        r.setex(redis_key, 86400, json.dumps(success_res))
        reverse_res = {"latitude": lat, "longitude": lng, "what3words": code}
        r.setex(f"kcode:coords:{code.lower()}", 86400, json.dumps(reverse_res))
    except Exception as se:
        print(f"Redis cache write error: {se}")
    return success_response(success_res)

@router.get("/convert-to-coordinates")
async def convert_to_coordinates(words: str):
    from ..core.redis import get_redis
    import json

    clean = words.strip().replace("///", "")
    redis_key = f"kcode:coords:{clean.lower()}"

    r = get_redis()
    try:
        cached = r.get(redis_key)
        if cached:
            return success_response(json.loads(cached))
    except Exception as re:
        print(f"Redis cache read error: {re}")

    # Decodes our own "ABC-XXXXXXXX" format. Anything unrecognized (an old
    # real what3words address from before this change, a stray paste, etc.)
    # degrades gracefully to a Nairobi default rather than erroring.
    lat, lng = kaalay_code_to_latlng(clean)

    success_res = {"latitude": lat, "longitude": lng, "what3words": clean}
    try:
        r.setex(redis_key, 86400, json.dumps(success_res))
        lat5 = f"{lat:.5f}"
        lng5 = f"{lng:.5f}"
        forward_res = {"words": clean, "lat": lat, "lng": lng}
        r.setex(f"kcode:words:{lat5}:{lng5}", 86400, json.dumps(forward_res))
    except Exception as se:
        print(f"Redis cache write error: {se}")
    return success_response(success_res)

@router.get("/safety-summary")
async def get_safety_summary(lat: float, lng: float):
    """Coarse, honest safety signal for the home screen — bucketed from real
    open-incident density nearby, not a fabricated risk score. Public (no
    auth) since it's just a read of aggregate counts, no incident detail."""
    from ..core.database import SessionLocal
    from ..models.all import Incident, IncidentStatus
    from datetime import datetime

    deg_radius = 3 / 111  # ~3km
    db = SessionLocal()
    try:
        nearby_open = db.query(Incident).filter(
            Incident.status.in_([IncidentStatus.OPEN, IncidentStatus.DISPATCHED]),
            Incident.lat.between(lat - deg_radius, lat + deg_radius),
            Incident.lng.between(lng - deg_radius, lng + deg_radius),
        ).count()
    finally:
        db.close()

    if nearby_open == 0:
        tier = "low"
    elif nearby_open <= 2:
        tier = "moderate"
    else:
        tier = "elevated"

    hour = datetime.now().hour
    return success_response({
        "riskTier": tier,
        "openIncidentsNearby": nearby_open,
        "isDaytime": 6 <= hour < 19,
    })

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
