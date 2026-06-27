from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ensure_columns():
    """There's no migration tool wired up (no Alembic) — Base.metadata.create_all()
    only creates missing *tables*, it never adds columns to ones that already
    exist. So adding a column to a model (e.g. Place.alwaysOpen) silently does
    nothing in production until this runs, and every query against that table
    500s on "column does not exist". This adds any model column missing from
    the live table, after create_all() has run."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue
            existing_columns = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                if not column.nullable and column.default is None and column.server_default is None:
                    print(f"⚠️  Skipping {table.name}.{column.name} — NOT NULL with no default, needs a real migration", flush=True)
                    continue
                col_type = column.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN IF NOT EXISTS "{column.name}" {col_type}'))
                print(f"🔧 Added missing column {table.name}.{column.name}", flush=True)
