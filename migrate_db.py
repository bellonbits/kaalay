import sys
from sqlalchemy import create_engine, text

# Get DB URL from .env or construct it
import os
from dotenv import load_dotenv
load_dotenv('apps/backend/.env')

db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/kaalay')

engine = create_engine(db_url)

def add_column_safe(engine, query, success_msg):
    try:
        with engine.connect() as conn:
            conn.execute(text(query))
            conn.commit()
            print(success_msg)
    except Exception as e:
        # Ignore already exists errors silently
        if "already exists" not in str(e):
            print(f"Error: {e}")

# Run migrations safely
add_column_safe(engine, 'ALTER TABLE drivers ADD COLUMN "vehicleCategory" VARCHAR DEFAULT \'economy\';', "Added vehicleCategory")
add_column_safe(engine, 'ALTER TABLE drivers ADD COLUMN "nationalIdUrl" VARCHAR;', "Added nationalIdUrl")
add_column_safe(engine, 'ALTER TABLE drivers ADD COLUMN "drivingLicenseUrl" VARCHAR;', "Added drivingLicenseUrl")
add_column_safe(engine, 'ALTER TABLE drivers ADD COLUMN "isVerified" BOOLEAN DEFAULT FALSE;', "Added isVerified")
add_column_safe(engine, 'ALTER TABLE drivers ADD COLUMN "acceptanceRate" FLOAT DEFAULT 1.0;', "Added acceptanceRate")
add_column_safe(engine, 'ALTER TABLE drivers ADD COLUMN "currentLat" FLOAT;', "Added currentLat")
add_column_safe(engine, 'ALTER TABLE drivers ADD COLUMN "currentLng" FLOAT;', "Added currentLng")
add_column_safe(engine, 'ALTER TABLE drivers ADD COLUMN "lastSeen" TIMESTAMP DEFAULT NOW();', "Added lastSeen")

print("Migration complete!")
