from .redis import get_redis
import json

QUEUE_NAME = "ride_requests_queue"

def publish_ride_request(ride_id: str, payload: dict):
    """Pushes a new ride request to the event queue (Simulating Kafka)"""
    r = get_redis()
    message = json.dumps({"rideId": ride_id, "payload": payload})
    r.lpush(QUEUE_NAME, message)
    print(f"Event Published: Ride {ride_id} added to {QUEUE_NAME}")

def consume_ride_requests(timeout=5):
    """Consumes the next available ride request from the queue"""
    r = get_redis()
    result = r.brpop(QUEUE_NAME, timeout=timeout)
    if result:
        _, message = result
        return json.loads(message)
    return None
