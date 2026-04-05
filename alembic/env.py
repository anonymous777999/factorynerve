from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from backend.database import Base

# Ensure all models are imported so metadata is complete.
import backend.models.organization  # noqa: F401
import backend.models.factory  # noqa: F401
import backend.models.user_factory_role  # noqa: F401
import backend.models.user  # noqa: F401
import backend.models.refresh_token  # noqa: F401
import backend.models.entry  # noqa: F401
import backend.models.alert  # noqa: F401
import backend.models.factory_settings  # noqa: F401
import backend.models.report  # noqa: F401
import backend.models.ocr_template  # noqa: F401
import backend.models.ocr_usage  # noqa: F401
import backend.models.user_plan  # noqa: F401
import backend.models.feature_usage  # noqa: F401
import backend.models.org_feature_usage  # noqa: F401
import backend.models.org_ocr_usage  # noqa: F401
import backend.models.email_queue  # noqa: F401
import backend.models.subscription  # noqa: F401
import backend.models.invoice  # noqa: F401
import backend.models.webhook_event  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_database_url() -> str:
    return os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")


def run_migrations_offline() -> None:
    url = _get_database_url()
    if not url:
        raise RuntimeError("DATABASE_URL must be set for Alembic migrations.")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = _get_database_url()
    if not url:
        raise RuntimeError("DATABASE_URL must be set for Alembic migrations.")

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        url=url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
