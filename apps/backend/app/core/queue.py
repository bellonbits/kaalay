import json
import logging
from .redis import get_redis

logger = logging.getLogger(__name__)

QUEUE_NAME = "ride_requests_queue"

async def publish_ride_request(ride_id: str, payload: dict):
    """Pushes a new ride request to the Kafka event queue (with Redis fallback)"""
    from .kafka import producer
    if producer:
        try:
            message = {"id": ride_id, **payload}
            await producer.send_and_wait("ride-requests", value=message)
            logger.info(f"Event Published to Kafka: Ride {ride_id} added to ride-requests")
        except Exception as e:
            logger.error(f"Kafka produce error, falling back to Redis: {e}")
            r = get_redis()
            msg = json.dumps({"rideId": ride_id, "payload": payload})
            r.lpush(QUEUE_NAME, msg)
    else:
        r = get_redis()
        msg = json.dumps({"rideId": ride_id, "payload": payload})
        r.lpush(QUEUE_NAME, msg)
        logger.info(f"Event Published (Fallback to Redis): Ride {ride_id} added to {QUEUE_NAME}")

def consume_ride_requests(timeout=5):
    """Consumes the next available ride request from the queue (Redis legacy fallback)"""
    r = get_redis()
    result = r.brpop(QUEUE_NAME, timeout=timeout)
    if result:
        _, message = result
        return json.loads(message)
    return None
