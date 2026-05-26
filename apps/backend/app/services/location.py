import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

class LocationService:
    def __init__(self):
        self.w3w_api_key = settings.W3W_API_KEY
        self.google_api_key = settings.GOOGLE_MAPS_API_KEY
        self.w3w_base_url = "https://api.what3words.com/v3"

    async def convert_to_coordinates(self, words: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.w3w_base_url}/convert-to-coordinates",
                params={"words": words, "key": self.w3w_api_key}
            )
            response.raise_for_status()
            data = response.json()
            return {
                "latitude": data["coordinates"]["lat"],
                "longitude": data["coordinates"]["lng"],
                "what3words": data["words"]
            }

    async def convert_to_3wa(self, lat: float, lng: float) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.w3w_base_url}/convert-to-3wa",
                params={"coordinates": f"{lat},{lng}", "key": self.w3w_api_key}
            )
            response.raise_for_status()
            data = response.json()
            return {
                "latitude": data["coordinates"]["lat"],
                "longitude": data["coordinates"]["lng"],
                "what3words": data["words"]
            }

    async def get_distance_and_duration(
        self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params={
                        "origins": f"{origin_lat},{origin_lng}",
                        "destinations": f"{dest_lat},{dest_lng}",
                        "mode": "driving",
                        "key": self.google_api_key
                    }
                )
                response.raise_for_status()
                data = response.json()
                if data["status"] == "OK" and data["rows"][0]["elements"][0]["status"] == "OK":
                    element = data["rows"][0]["elements"][0]
                    return {
                        "distance": element["distance"]["text"],
                        "distanceValue": element["distance"]["value"],
                        "duration": element["duration"]["text"],
                        "durationValue": element["duration"]["value"]
                    }
            except Exception as e:
                print(f"Google Distance Matrix error: {e}, falling back to Haversine")

        # Fallback for off-road/remote regions: Calculate direct crow-flies path using Haversine formula
        import math
        R = 6371  # Earth radius in km
        dLat = math.radians(dest_lat - origin_lat)
        dLng = math.radians(dest_lng - origin_lng)
        a = math.sin(dLat/2)**2 + math.cos(math.radians(origin_lat)) * math.cos(math.radians(dest_lat)) * math.sin(dLng/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance_km = R * c
        duration_mins = max(1, round(distance_km * 2.5))  # Driving off-road assumes slower speed (~20-25 km/h)
        
        return {
            "distance": f"{distance_km:.1f} km (direct)",
            "distanceValue": int(distance_km * 1000),  # in meters
            "duration": f"{duration_mins} mins",
            "durationValue": duration_mins * 60  # in seconds
        }

location_service = LocationService()
