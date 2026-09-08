"""add new agent deliverable types (pdf_report, business_card, letterhead,
smart_contract, social_media_strategy, analytics, marketing_strategy)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-11

"""
from alembic import op

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

NEW_VALUES = [
    "pdf_report",
    "business_card",
    "letterhead",
    "smart_contract",
    "social_media_strategy",
    "analytics",
    "marketing_strategy",
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            for value in NEW_VALUES:
                op.execute(
                    f"ALTER TYPE deliverabletype ADD VALUE IF NOT EXISTS '{value}'"
                )


def downgrade() -> None:
    # Postgres has no direct "remove enum value" support.
    # Rolling back the application code is sufficient.
    pass
