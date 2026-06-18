from fastapi import APIRouter, Depends
import requests
from ..core.config import settings
from ..core.responses import success_response, error_response
from ..core.deps import get_current_user
from ..models.all import User

router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/current")
async def get_current_weather(lat: float, lng: float, current_user: User = Depends(get_current_user)):
    if not settings.OPENWEATHER_API_KEY:
        return error_response("WEATHER_NOT_CONFIGURED", "Weather isn't available right now", 503)
    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"lat": lat, "lon": lng, "appid": settings.OPENWEATHER_API_KEY, "units": "metric"},
            timeout=5,
        )
        data = resp.json()
        if resp.status_code != 200:
            return error_response("WEATHER_LOOKUP_FAILED", data.get("message", "Couldn't fetch weather"), 502)
        weather = (data.get("weather") or [{}])[0]
        return success_response({
            "tempC": round(data["main"]["temp"]),
            "feelsLikeC": round(data["main"]["feels_like"]),
            "condition": weather.get("main", ""),
            "description": weather.get("description", ""),
            "humidity": data["main"].get("humidity"),
            "windKph": round((data.get("wind", {}).get("speed") or 0) * 3.6, 1),
            "cityName": data.get("name") or "",
        })
    except Exception as e:
        return error_response("WEATHER_LOOKUP_FAILED", str(e), 502)
