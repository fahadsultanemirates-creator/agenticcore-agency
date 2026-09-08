"""
Database connection setup.

Points at the Supabase Postgres instance via DATABASE_URL (the connection
string from Supabase's project settings -> Database -> Connection string,
"URI" tab). Session-per-request pattern via get_session().
"""

import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.environ.get("NEXUS_DB_URL")

_engine = None
_SessionLocal = None

if DATABASE_URL:
    try:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    except Exception as _db_err:
        import logging as _log
        _log.getLogger("agenticcore-agency").warning(
            f"Database driver unavailable — running stateless ({_db_err})"
        )


def is_configured() -> bool:
    return _engine is not None


@contextmanager
def get_session() -> Session:
    if _SessionLocal is None:
        raise RuntimeError(
            "NEXUS_DB_URL is not set — add your Supabase Postgres connection "
            "string in Secrets to enable persistence."
        )
    session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
