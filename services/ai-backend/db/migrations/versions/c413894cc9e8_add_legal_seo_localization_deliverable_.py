"""add legal/seo/localization deliverable types

Revision ID: c413894cc9e8
Revises: 0a5eefa3229a
Create Date: 2026-08-04

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "c413894cc9e8"
down_revision = "0a5eefa3229a"
branch_labels = None
depends_on = None

NEW_VALUES = ["legal", "seo", "localization"]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # ALTER TYPE ... ADD VALUE can't run inside a transaction (and a
        # newly-added value can't be used within the transaction that added
        # it either), so this has to run in an autocommit block.
        with op.get_context().autocommit_block():
            for value in NEW_VALUES:
                op.execute(f"ALTER TYPE deliverabletype ADD VALUE IF NOT EXISTS '{value}'")
    # Other dialects (e.g. SQLite, used for local/dev testing) store this
    # enum as an inline CHECK constraint rather than a separate named type
    # — there's nothing to alter; the new Python-side enum values just take
    # effect once the app is running the updated model.


def downgrade() -> None:
    # Postgres has no direct "remove enum value" support (would require
    # rebuilding the type and every column using it). Left as a no-op;
    # rolling back the application code is sufficient since old code never
    # writes these values.
    pass
