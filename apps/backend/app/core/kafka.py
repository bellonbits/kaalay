import json
import logging
import asyncio
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from aiokafka.admin import AIOKafkaAdminClient, NewTopic
from typing import Optional
from .config import settings

logger = logging.getLogger(__name__)

# Singletons for producer and consumer task
producer: Optional[AIOKafkaProducer] = None
consumer_task: Optional[asyncio.Task] = None

KAFKA_BROKER_URL = settings.KAFKA_BOOTSTRAP_SERVERS
LOCATION_TOPIC = "location_updates"

async def ensure_kafka_topics():
    admin = AIOKafkaAdminClient(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
    )
    try:
        await admin.start()
        existing = await admin.list_topics()
        topics_to_create = []
        
        for topic in ['ride-requests', 'ride-status', 'sos-alerts', 'location_updates']:
            if topic not in existing:
                topics_to_create.append(
                    NewTopic(name=topic, num_partitions=1, replication_factor=1)
                )
        
        if topics_to_create:
            await admin.create_topics(topics_to_create)
            logger.info(f"Created Kafka topics: {[t.name for t in topics_to_create]}")
    except Exception as e:
        logger.error(f"Error ensuring Kafka topics: {e}")
    finally:
        await admin.close()

async def init_kafka():
    global producer, consumer_task
    try:
        await ensure_kafka_topics()  # Pre-create topics before starting producer or consumer
        
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
    retries = 0
    while True:
        try:
            consumer = AIOKafkaConsumer(
                LOCATION_TOPIC,
                bootstrap_servers=KAFKA_BROKER_URL,
                group_id="location_processor_group",
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                session_timeout_ms=30000,
                heartbeat_interval_ms=3000,
                request_timeout_ms=40000,
            )
            await consumer.start()
            logger.info("Kafka Consumer started listening for location updates.")
            retries = 0
            
            async for msg in consumer:
                try:
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
                except Exception as e:
                    logger.error(f"Error processing consumer message: {e}")
        except asyncio.CancelledError:
            logger.info("Kafka Consumer task cancelled.")
            break
        except Exception as e:
            retries += 1
            wait = min(2 ** retries, 30)
            logger.error(f"Kafka consumer crashed (attempt {retries}), retrying in {wait}s: {e}")
            await asyncio.sleep(wait)
        finally:
            try:
                await consumer.stop()
            except:
                pass
