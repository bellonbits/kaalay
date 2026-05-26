import sys
from sqlalchemy import create_engine, text

# Get DB URL from .env or construct it
import os
from dotenv import load_dotenv
load_dotenv('apps/backend/.env')

db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/kaalay')

engine = create_engine(db_url)

with engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE drivers ADD COLUMN "vehicleCategory" VARCHAR DEFAULT \'economy\';'))
        print("Added vehicleCategory")
    except Exception as e:
        print(e)
    
    try:
        conn.execute(text('ALTER TABLE drivers ADD COLUMN "nationalIdUrl" VARCHAR;'))
        print("Added nationalIdUrl")
    except Exception as e:
        print(e)

    try:
        conn.execute(text('ALTER TABLE drivers ADD COLUMN "drivingLicenseUrl" VARCHAR;'))
        print("Added drivingLicenseUrl")
    except Exception as e:
        print(e)

    try:
        conn.execute(text('ALTER TABLE drivers ADD COLUMN "isVerified" BOOLEAN DEFAULT FALSE;'))
        print("Added isVerified")
    except Exception as e:
        print(e)
    
    conn.commit()
print("Migration complete!")
