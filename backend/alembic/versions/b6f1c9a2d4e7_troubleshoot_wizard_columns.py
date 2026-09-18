"""troubleshoot wizard columns

Adds the columns the ported troubleshoot wizard (intake/vision/ranking/
report domains) needs on cases, and the is_change column on check_results
that fixes Case.action_count to count changes, not iterations.

Revision ID: b6f1c9a2d4e7
Revises: 98d439ab515b
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b6f1c9a2d4e7'
down_revision: Union[str, Sequence[str], None] = '98d439ab515b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    rank_tier = postgresql.ENUM('T1', 'T2', 'T3', 'T4', name='rank_tier')
    rank_tier.create(op.get_bind(), checkfirst=True)

    op.add_column('cases', sa.Column('vision_result', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('cases', sa.Column('ranking', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('cases', sa.Column('rank_tier', rank_tier, nullable=True))
    op.add_column('cases', sa.Column('llm_map_used', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('cases', sa.Column('llm_critic_used', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('cases', sa.Column('llm_explain_used', sa.Boolean(), nullable=False, server_default=sa.false()))

    op.add_column('check_results', sa.Column('is_change', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('check_results', 'is_change')

    op.drop_column('cases', 'llm_explain_used')
    op.drop_column('cases', 'llm_critic_used')
    op.drop_column('cases', 'llm_map_used')
    op.drop_column('cases', 'rank_tier')
    op.drop_column('cases', 'ranking')
    op.drop_column('cases', 'vision_result')

    postgresql.ENUM(name='rank_tier').drop(op.get_bind(), checkfirst=True)
