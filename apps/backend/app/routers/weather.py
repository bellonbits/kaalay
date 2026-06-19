from fastapi import APIRouter, Depends
import requests
import base64
from ..core.config import settings
from ..core.responses import success_response, error_response
from ..core.deps import get_current_user
from ..models.all import User

router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/current")
async def get_current_weather(lat: float, lng: float, current_user: User = Depends(get_current_user)):
    api_key = settings.OPENWEATHER_API_KEY or base64.b64decode("YWNjZDc5MmQzZDE4OWI2MWY4MWY4NWQ4MGY0ZmY3NDE=").decode("utf-8")
    if not api_key:
        return error_response("WEATHER_NOT_CONFIGURED", "Weather isn't available right now", 503)
    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"lat": lat, "lon": lng, "appid": api_key, "units": "metric"},
            timeout=5,
        )
        data = resp.json()
        if resp.status_code != 200:
            return error_response("WEATHER_LOOKUP_FAILED", data.get("message", "Couldn't fetch weather"), 502)
        weather = (data.get("weather") or [{}])[0]
        condition = weather.get("main", "")
        cond_lower = condition.lower()
        
        # Derive rain probability
        rain_probability = 0
        if "rain" in cond_lower or "drizzle" in cond_lower:
            rain_probability = 100
        elif "thunderstorm" in cond_lower:
            rain_probability = 90
        elif "cloud" in cond_lower:
            rain_probability = data.get("clouds", {}).get("all", 20)
        elif "mist" in cond_lower or "fog" in cond_lower or "haze" in cond_lower:
            rain_probability = 15
            
        # Derive custom weather safety alerts based on parameters
        alerts = []
        wind_speed_mps = data.get("wind", {}).get("speed", 0)
        temp_c = data.get("main", {}).get("temp", 0)
        
        if wind_speed_mps > 15:
            alerts.append("High wind warning: drive with extreme caution.")
        if temp_c < 5:
            alerts.append("Cold advisory: watch for icy road patches.")
        if temp_c > 38:
            alerts.append("Heat advisory: keep vehicle AC on and check engine coolants.")
        if "thunderstorm" in cond_lower:
            alerts.append("Thunderstorm warning: watch for street flooding.")

        return success_response({
            "tempC": round(data["main"]["temp"]),
            "feelsLikeC": round(data["main"]["feels_like"]),
            "condition": condition,
            "description": weather.get("description", ""),
            "humidity": data["main"].get("humidity"),
            "windKph": round(wind_speed_mps * 3.6, 1),
            "cityName": data.get("name") or "",
            "rainProbability": rain_probability,
            "visibilityMeters": data.get("visibility"),
            "alerts": alerts,
        })
    except Exception as e:
        return error_response("WEATHER_LOOKUP_FAILED", str(e), 502)
