# Placeholder emergency-facility seed data. Coordinates are approximate
# (sourced from general knowledge, not surveyed/verified) — good enough to
# exercise the "nearest facility" feature end to end, but MUST be replaced
# with verified coordinates/phone numbers before this is relied on for a
# real dispatch decision.
from .core.database import SessionLocal
from .models.all import EmergencyFacility, FacilityType

FACILITIES = [
    # Nairobi, Kenya
    {"name": "Kenyatta National Hospital", "type": FacilityType.HOSPITAL, "lat": -1.3010, "lng": 36.8073, "city": "Nairobi"},
    {"name": "Nairobi Central Police Station", "type": FacilityType.POLICE, "lat": -1.2841, "lng": 36.8233, "city": "Nairobi"},
    {"name": "Nairobi Central Fire Station", "type": FacilityType.FIRE, "lat": -1.2864, "lng": 36.8172, "city": "Nairobi"},
    # Mogadishu, Somalia
    {"name": "Banadir Hospital", "type": FacilityType.HOSPITAL, "lat": 2.0371, "lng": 45.3438, "city": "Mogadishu"},
    {"name": "Mogadishu Police Headquarters", "type": FacilityType.POLICE, "lat": 2.0469, "lng": 45.3182, "city": "Mogadishu"},
    # Hargeisa, Somaliland
    {"name": "Hargeisa Group Hospital", "type": FacilityType.HOSPITAL, "lat": 9.5600, "lng": 44.0650, "city": "Hargeisa"},
    {"name": "Hargeisa Central Police Station", "type": FacilityType.POLICE, "lat": 9.5616, "lng": 44.0700, "city": "Hargeisa"},
    # Addis Ababa, Ethiopia
    {"name": "Tikur Anbessa (Black Lion) Hospital", "type": FacilityType.HOSPITAL, "lat": 9.0307, "lng": 38.7613, "city": "Addis Ababa"},
    {"name": "Addis Ababa Police Commission", "type": FacilityType.POLICE, "lat": 9.0150, "lng": 38.7450, "city": "Addis Ababa"},
    # Kampala, Uganda
    {"name": "Mulago National Referral Hospital", "type": FacilityType.HOSPITAL, "lat": 0.3422, "lng": 32.5763, "city": "Kampala"},
    {"name": "Kampala Central Police Station", "type": FacilityType.POLICE, "lat": 0.3163, "lng": 32.5822, "city": "Kampala"},
    # Dar es Salaam, Tanzania
    {"name": "Muhimbili National Hospital", "type": FacilityType.HOSPITAL, "lat": -6.8042, "lng": 39.2685, "city": "Dar es Salaam"},
    {"name": "Dar es Salaam Central Police Station", "type": FacilityType.POLICE, "lat": -6.8161, "lng": 39.2904, "city": "Dar es Salaam"},
    # Djibouti City, Djibouti
    {"name": "Hopital General Peltier", "type": FacilityType.HOSPITAL, "lat": 11.5950, "lng": 43.1450, "city": "Djibouti City"},
    {"name": "Djibouti Police Headquarters", "type": FacilityType.POLICE, "lat": 11.5900, "lng": 43.1450, "city": "Djibouti City"},
]


def seed_emergency_facilities():
    db = SessionLocal()
    try:
        if db.query(EmergencyFacility).count() > 0:
            return
        for f in FACILITIES:
            db.add(EmergencyFacility(**f))
        db.commit()
        print(f"Seeded {len(FACILITIES)} emergency facilities (placeholder data)", flush=True)
    except Exception as e:
        print(f"Emergency facility seed error: {e}", flush=True)
    finally:
        db.close()
