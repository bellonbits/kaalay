from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Literal, Optional
import requests
from ..core.config import settings
from ..core.responses import success_response, error_response
from ..core.deps import get_current_user
from ..models.all import User

router = APIRouter(prefix="/ai", tags=["ai"])

MODEL = "claude-opus-4-8"

# Mirrors rides.py's /rides/estimate fare math — kept as a plain function so
# the tool doesn't need a second HTTP round trip into our own API.
BASE_FARES = {"economy": 50.0, "motorcycle": 30.0, "xl": 100.0, "delivery": 40.0}
PER_KM_RATES = {"economy": 40.0, "motorcycle": 20.0, "xl": 70.0, "delivery": 30.0}

SYSTEM_PROMPT = (
    "You are Kaalay's ride-booking assistant. The rider's current position is "
    "given to you on every turn. When they describe where they want to go, call "
    "find_destination to resolve it. Once you have the destination's coordinates, "
    "compute the straight-line distance in kilometres from the rider's position "
    "using the haversine formula, then call estimate_fare with that distance. "
    "Default to the economy category unless the rider asks for something else. "
    "Keep replies short and friendly — a sentence or two. Never state a "
    "destination or a fare you haven't actually gotten back from a tool call."
)

TOOLS = [
    {
        "name": "find_destination",
        "description": (
            "Look up a destination by name or description near the rider's current "
            "location. Call this whenever the user names a place they want to go."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The place name or description, e.g. 'Westlands' or 'the nearest pharmacy'",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "estimate_fare",
        "description": (
            "Estimate the ride fare and ETA once you know the trip distance in "
            "kilometres. Call this only after find_destination has resolved a "
            "destination."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "distance_km": {
                    "type": "number",
                    "description": "Straight-line distance from the rider's position to the destination, in kilometres",
                },
                "category": {
                    "type": "string",
                    "enum": ["economy", "motorcycle", "xl", "delivery"],
                },
            },
            "required": ["distance_km", "category"],
        },
    },
]


def _find_destination(query: str, lat: float, lng: float) -> dict:
    if not settings.GOOGLE_MAPS_SERVER_KEY:
        return {"found": False, "reason": "Place lookup is not configured"}
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/place/textsearch/json",
            params={
                "query": query,
                "location": f"{lat},{lng}",
                "radius": 20000,
                "key": settings.GOOGLE_MAPS_SERVER_KEY,
            },
            timeout=5,
        )
        results = (resp.json() or {}).get("results") or []
        if not results:
            return {"found": False, "reason": "No matching place found"}
        top = results[0]
        loc = top["geometry"]["location"]
        return {
            "found": True,
            "name": top.get("name"),
            "address": top.get("formatted_address"),
            "lat": loc["lat"],
            "lng": loc["lng"],
        }
    except Exception as e:
        return {"found": False, "reason": str(e)}


def _estimate_fare(distance_km: float, category: str) -> dict:
    category = category if category in BASE_FARES else "economy"
    fare = BASE_FARES[category] + PER_KM_RATES[category] * max(0.0, distance_km)
    eta_minutes = max(3, round((distance_km / 30) * 60))
    return {"category": category, "fare": round(fare, 2), "etaMinutes": eta_minutes, "currency": "KES"}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    lat: float
    lng: float


@router.post("/chat")
async def chat(dto: ChatRequest, current_user: User = Depends(get_current_user)):
    if not settings.ANTHROPIC_API_KEY:
        return error_response("AI_NOT_CONFIGURED", "AI booking isn't available right now", 503)

    from anthropic import Anthropic
    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    messages = [{"role": m.role, "content": m.text} for m in (dto.history or [])]
    messages.append({
        "role": "user",
        "content": f"My current position is lat={dto.lat}, lng={dto.lng}. {dto.message}",
    })

    suggested_ride = None
    resolved_destination = None

    # Capped so a confused tool-use loop can't run away — a real booking flow
    # only ever needs find_destination then estimate_fare (2 rounds).
    for _ in range(4):
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
            output_config={"effort": "low"},
        )

        if response.stop_reason != "tool_use":
            reply_text = "".join(b.text for b in response.content if b.type == "text")
            return success_response({"reply": reply_text, "suggestedRide": suggested_ride})

        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            if block.name == "find_destination":
                result = _find_destination(block.input.get("query", ""), dto.lat, dto.lng)
                if result.get("found"):
                    resolved_destination = result
            elif block.name == "estimate_fare":
                result = _estimate_fare(block.input.get("distance_km", 0), block.input.get("category", "economy"))
                if resolved_destination:
                    suggested_ride = {
                        **result,
                        "destination": {
                            "lat": resolved_destination["lat"],
                            "lng": resolved_destination["lng"],
                            "label": resolved_destination.get("name") or resolved_destination.get("address"),
                        },
                    }
            else:
                result = {"error": f"Unknown tool {block.name}"}
            tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": str(result)})
        messages.append({"role": "user", "content": tool_results})

    return success_response({
        "reply": "I'm having trouble finding that — could you rephrase your destination?",
        "suggestedRide": suggested_ride,
    })
