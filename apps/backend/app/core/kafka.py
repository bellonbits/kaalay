import json
import logging
import asyncio
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from typing import Optional

logger = logging.getLogger(__name__)

# Singletons for producer and consumer task
producer: Optional[AIOKafkaProducer] = None
consumer_task: Optional[asyncio.Task] = None

KAFKA_BROKER_URL = "kafka:9092"
LOCATION_TOPIC = "location_updates"

async def init_kafka():
    global producer, consumer_task
    try:
        producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BROKER_URL,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        await producer.start()
        logger.info("Kafka Producer started.")
        
        # Start consumer task
        consumer_task = asyncio.create_task(consume_locations())
    except Exception as e:
        logger.error(f"Failed to initialize Kafka: {e}")

async def close_kafka():
    global producer, consumer_task
    if producer:
        await producer.stop()
        logger.info("Kafka Producer stopped.")
    if consumer_task:
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass
        logger.info("Kafka Consumer stopped.")

async def produce_location_update(data: dict):
    if not producer:
        logger.warning("Kafka Producer is not initialized.")
        return
    try:
        await producer.send_and_wait(LOCATION_TOPIC, value=data)
    except Exception as e:
        logger.error(f"Error producing to Kafka: {e}")

async def consume_locations():
    consumer = AIOKafkaConsumer(
        LOCATION_TOPIC,
        bootstrap_servers=KAFKA_BROKER_URL,
        group_id="location_processor_group",
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )
    
    # Wait for broker to be ready in docker-compose
    retries = 5
    while retries > 0:
        try:
            await consumer.start()
            break
        except Exception as e:
            logger.warning(f"Kafka consumer start failed, retrying... ({e})")
            retries -= 1
            await asyncio.sleep(2)
            
    if retries == 0:
        logger.error("Failed to start Kafka consumer after retries.")
        return

    logger.info("Kafka Consumer started listening for location updates.")
    try:
        async for msg in consumer:
            data = msg.value
            lat = data.get("lat")
            lng = data.get("lng")
            driver_id = data.get("driverId")
            
            if lat and lng and driver_id:
                try:
                    from .redis import get_redis
                    r = get_redis()
                    # Store in Redis GEO set for radius searching
                    r.geoadd("driver_locations", (lng, lat, str(driver_id)))
                    # Also set a TTL for driver availability
                    r.setex(f"driver_active:{driver_id}", 30, "online")
                except Exception as e:
                    logger.error(f"Redis GEO error in Kafka consumer: {e}")
    except asyncio.CancelledError:
        pass
    finally:
        await consumer.stop()
