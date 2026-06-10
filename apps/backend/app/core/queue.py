import json
import logging
from .redis import get_redis

logger = logging.getLogger(__name__)

QUEUE_NAME = "ride_requests_queue"

async def publish_ride_request(ride_id: str, payload: dict):
    """Push a new ride request onto the Redis dispatch queue."""
    r = get_redis()
    msg = json.dumps({"rideId": ride_id, "payload": payload})
    r.lpush(QUEUE_NAME, msg)
    logger.info(f"Ride {ride_id} queued on {QUEUE_NAME}")

def consume_ride_requests(timeout=5):
    """Block up to `timeout` seconds for the next ride request."""
    r = get_redis()
    result = r.brpop(QUEUE_NAME, timeout=timeout)
    if result:
        _, message = result
        return json.loads(message)
    return None
