"""check_results.is_change — separate observing from changing

Step 8's "exactly one thing was changed" was measured with
``len(check_results)``, which counted looking at something as changing it.
See CheckResult.is_change and Case.action_count.

Existing rows are backfilled False (observation). Neither value is what
the operator actually recorded — the column didn't exist when those rows
were written — and False is the non-destructive reading: it can only
remove a change that was never stated, never invent one. Cases already
closed keep the tier they were closed with; re-close a case to have it
re-scored under the new rule.

Revision ID: c2a7f1e4b930
Revises: bbf1d5b653fa
Create Date: 2026-09-18

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c2a7f1e4b930'
down_revision: Union[str, Sequence[str], None] = 'bbf1d5b653fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'check_results',
        sa.Column('is_change', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('check_results', 'is_change')
