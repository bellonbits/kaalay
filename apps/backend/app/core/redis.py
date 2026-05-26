import redis
from .config import settings

# Global redis connection pool
pool = redis.ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,
    decode_responses=True
)

def get_redis():
    return redis.Redis(connection_pool=pool)

# Test connection
try:
    r = get_redis()
    r.ping()
    print("✅ Redis connection established")
except Exception as e:
    print(f"❌ Redis connection failed: {e}")
