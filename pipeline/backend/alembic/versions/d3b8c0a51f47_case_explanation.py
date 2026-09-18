"""cases.explanation — keep the written analysis instead of losing it

The step-7 explanation was generated and returned, never stored. Because
W7 allows one explanation call per case, ``llm_explain_used`` then blocked
a second one — so every time a report was reopened its "AI Analysis"
section came back empty, and the printed report had a permanently blank
section on any case that wasn't freshly finished.

Storing it also makes the report reproducible: the same case re-read a
month later shows the analysis it was actually closed on, not a new one
written against a ranking that has since moved.

Existing rows backfill NULL — those explanations were never persisted and
cannot be recovered. Re-running the report on a case whose LLM budget is
spent will show no explanation, which is the honest state.

Revision ID: d3b8c0a51f47
Revises: c2a7f1e4b930
Create Date: 2026-09-18

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd3b8c0a51f47'
down_revision: Union[str, Sequence[str], None] = 'c2a7f1e4b930'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('cases', sa.Column('explanation', sa.Text(), nullable=True))
    op.add_column(
        'cases',
        sa.Column('explanation_used_llm', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('cases', 'explanation_used_llm')
    op.drop_column('cases', 'explanation')
