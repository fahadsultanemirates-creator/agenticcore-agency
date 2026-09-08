"""
SQLAlchemy models for the AgenticCore.agency persistence layer (Supabase Postgres).

Table shape, top to bottom:
  customers            -- one row per end user (API customer_id or Telegram chat_id)
  conversation_messages -- turn-by-turn history, powers Manager memory
  projects             -- a logical unit of work for a customer (e.g. one site build)
  deliverables         -- agent output that can be looked up and edited instead of
                           regenerated (site HTML, copy, audits, analyses, ...)
  jobs / job_events     -- background execution tracking (see jobs/runner.py)
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    external_ref: Mapped[str] = mapped_column(String, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    messages: Mapped[list["ConversationMessage"]] = relationship(back_populates="customer")
    projects: Mapped[list["Project"]] = relationship(back_populates="customer")
    jobs: Mapped[list["Job"]] = relationship(back_populates="customer")


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole))
    content: Mapped[str] = mapped_column(Text)
    agents_used: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    customer: Mapped["Customer"] = relationship(back_populates="messages")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    customer: Mapped["Customer"] = relationship(back_populates="projects")
    deliverables: Mapped[list["Deliverable"]] = relationship(back_populates="project")
    files: Mapped[list["ProjectFile"]] = relationship(back_populates="project")


class ProjectFile(Base):
    """One file in a multi-page site manifest produced by developer_agent.

    Each project has at most one row per filename (unique constraint).
    Upserts on (project_id, filename) keep only the latest version of
    each file so the full manifest is always reconstructable from this
    table without scanning deliverable history.
    """

    __tablename__ = "project_files"
    __table_args__ = (UniqueConstraint("project_id", "filename", name="uq_project_file"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    filename: Mapped[str] = mapped_column(String, index=True)
    purpose: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="files")


class DeliverableType(str, enum.Enum):
    feasibility = "feasibility"
    site_architecture = "site_architecture"
    site_html = "site_html"
    qa_review = "qa_review"
    content_copy = "content_copy"
    marketing_copy = "marketing_copy"
    bookkeeping = "bookkeeping"
    legal = "legal"
    seo = "seo"
    localization = "localization"
    image = "image"
    video = "video"
    deployment = "deployment"
    deep_analysis = "deep_analysis"
    site_audit = "site_audit"
    # New agents added Aug 2026
    pdf_report = "pdf_report"
    business_card = "business_card"
    letterhead = "letterhead"
    smart_contract = "smart_contract"
    social_media_strategy = "social_media_strategy"
    analytics = "analytics"
    marketing_strategy = "marketing_strategy"


class DeliverableStatus(str, enum.Enum):
    draft = "draft"
    final = "final"


class Deliverable(Base):
    __tablename__ = "deliverables"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    type: Mapped[DeliverableType] = mapped_column(Enum(DeliverableType), index=True)
    content: Mapped[str] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[DeliverableStatus] = mapped_column(Enum(DeliverableStatus), default=DeliverableStatus.final)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="deliverables")


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.queued, index=True)
    request_text: Mapped[str] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    customer: Mapped["Customer"] = relationship(back_populates="jobs")
    events: Mapped[list["JobEvent"]] = relationship(back_populates="job", order_by="JobEvent.created_at")


class JobEvent(Base):
    __tablename__ = "job_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    step_name: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    job: Mapped["Job"] = relationship(back_populates="events")
