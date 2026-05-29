import asyncio
import logging
import json
from aiokafka import AIOKafkaConsumer
from ..core.config import settings
from ..core.redis import get_redis
from ..core.sio import sio
from ..core.database import SessionLocal
from ..models.all import Driver

logger = logging.getLogger(__name__)

async def start_driver_assignment_worker():
    # Wait an extra buffer after backend starts — Kafka may still be warming up
    logger.info("⏳ Waiting for Kafka to warm up before starting Driver Assignment Service...")
    await asyncio.sleep(5)
    
    retries = 0
    while True:
        consumer = None
        try:
            consumer = AIOKafkaConsumer(
                'ride-requests',
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id='driver_assignment_group',  # rename — avoid collision with old dead group
                auto_offset_reset='earliest',
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                session_timeout_ms=45000,    # 45s — gives time if Kafka is slow
                heartbeat_interval_ms=10000, # 10s — must be < session_timeout / 3
                request_timeout_ms=60000,
                max_poll_interval_ms=300000,
            )
            await consumer.start()
            logger.info("✅ Kafka consumer started successfully for Driver Assignment")
            retries = 0

            async for msg in consumer:
                try:
                    data = msg.value
                    await handle_ride_request(data)
                except Exception as e:
                    logger.error(f"Error handling ride request: {e}", exc_info=True)
                    # Never re-raise here — one bad message should not kill the consumer

        except asyncio.CancelledError:
            logger.info("Driver Assignment Service cancelled.")
            break
        except Exception as e:
            retries += 1
            wait = min(5 * retries, 60)  # 5s, 10s, 15s... max 60s
            logger.error(f"Kafka consumer failed (attempt {retries}), retrying in {wait}s: {e}")
            await asyncio.sleep(wait)
        finally:
            if consumer:
                try:
                    await consumer.stop()
                except Exception:
                    pass


async def handle_ride_request(data: dict):
    ride_id = data.get('id')
    category = data.get('category')
    pickup_lat = data.get('pickupLat')
    pickup_lng = data.get('pickupLng')

    if not all([ride_id, pickup_lat, pickup_lng]):
        logger.warning(f"Incomplete ride request data: {data}")
        return

    # Find nearest online driver via Redis GEOSEARCH
    r = get_redis()
    nearby = r.geosearch(
        name="driver_locations",
        longitude=pickup_lng,
        latitude=pickup_lat,
        radius=10,
        unit="km",
        withdist=True,
        sort="ASC"
    )

    if not nearby:
        logger.info(f"No drivers found near ride {ride_id}")
        return

    db = SessionLocal()
    try:
        for driver_id, dist in nearby:
            driver = db.query(Driver).filter(Driver.id == driver_id).first()
            if not driver:
                continue

            driver_category = getattr(driver, 'vehicleCategory', 'economy') or 'economy'
            if category and category != 'any' and driver_category != category:
                continue

            user_id = str(driver.userId)
            logger.info(f"📡 Dispatching Ride {ride_id} to Driver {user_id} ({dist:.2f}km away)")
            
            await sio.emit('job_offer', {
                "rideId": ride_id,
                "pickup": data.get("pickupWhat3words"),
                "destination": data.get("destinationWhat3words"),
                "fare": data.get("fare"),
                "distanceKm": round(dist, 2),
                "category": category
            }, room=user_id, namespace="/loc")
    except Exception as e:
        logger.error(f"Error dispatching ride {ride_id}: {e}", exc_info=True)
    finally:
        db.close()
