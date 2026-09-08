"""
Repository functions — the only place the rest of the app should touch the
database from. Each function opens its own session via get_session(), so
callers don't need to manage sessions themselves.
"""

from datetime import datetime

from sqlalchemy import select

from db.client import get_session
from db.models import (
    ConversationMessage,
    Customer,
    Deliverable,
    DeliverableStatus,
    DeliverableType,
    Job,
    JobEvent,
    JobStatus,
    MessageRole,
    Project,
    ProjectFile,
)


# ------------------------------------------------------------
# Customers
# ------------------------------------------------------------

def get_or_create_customer(external_ref: str) -> str:
    """Returns the customer id for this external_ref (customer_id or
    Telegram chat_id), creating the row if it doesn't exist yet."""
    with get_session() as session:
        customer = session.scalar(select(Customer).where(Customer.external_ref == external_ref))
        if customer is None:
            customer = Customer(external_ref=external_ref)
            session.add(customer)
            session.flush()
        return customer.id


# ------------------------------------------------------------
# Conversation history
# ------------------------------------------------------------

def save_message(customer_id: str, role: str, content: str, agents_used: list[str] | None = None) -> None:
    with get_session() as session:
        session.add(ConversationMessage(
            customer_id=customer_id,
            role=MessageRole(role),
            content=content,
            agents_used=agents_used,
        ))


def get_recent_messages(customer_id: str, limit: int = 20) -> list[dict]:
    """Returns up to `limit` most recent messages, oldest first, as plain
    dicts ({"role": ..., "content": ...}) ready to feed back to Gemini."""
    with get_session() as session:
        rows = session.scalars(
            select(ConversationMessage)
            .where(ConversationMessage.customer_id == customer_id)
            .order_by(ConversationMessage.created_at.desc())
            .limit(limit)
        ).all()
    rows = list(reversed(rows))
    return [{"role": row.role.value, "content": row.content} for row in rows]


# ------------------------------------------------------------
# Projects
# ------------------------------------------------------------

def get_or_create_project(customer_id: str, name: str = "default") -> str:
    """Customers currently work within a single default project per name.
    Callers that want a fresh project (e.g. a distinct site build) should
    pass a distinguishing name."""
    with get_session() as session:
        project = session.scalar(
            select(Project).where(Project.customer_id == customer_id, Project.name == name)
        )
        if project is None:
            project = Project(customer_id=customer_id, name=name)
            session.add(project)
            session.flush()
        return project.id


# ------------------------------------------------------------
# Deliverables
# ------------------------------------------------------------

def get_latest_deliverable(project_id: str, deliverable_type: str) -> dict | None:
    with get_session() as session:
        row = session.scalar(
            select(Deliverable)
            .where(Deliverable.project_id == project_id, Deliverable.type == DeliverableType(deliverable_type))
            .order_by(Deliverable.version.desc())
            .limit(1)
        )
        if row is None:
            return None
        return {
            "id": row.id,
            "content": row.content,
            "url": row.url,
            "version": row.version,
        }


def upsert_deliverable(
    project_id: str,
    deliverable_type: str,
    content: str,
    url: str | None = None,
    status: str = "final",
) -> dict:
    """Creates a new version of a deliverable. Callers decide edit-vs-create
    at the Manager level (by passing existing content back through the
    agent); this always records the result as the newest version so history
    is preserved rather than overwritten in place."""
    with get_session() as session:
        latest = session.scalar(
            select(Deliverable)
            .where(Deliverable.project_id == project_id, Deliverable.type == DeliverableType(deliverable_type))
            .order_by(Deliverable.version.desc())
            .limit(1)
        )
        next_version = (latest.version + 1) if latest else 1
        row = Deliverable(
            project_id=project_id,
            type=DeliverableType(deliverable_type),
            content=content,
            url=url,
            version=next_version,
            status=DeliverableStatus(status),
        )
        session.add(row)
        session.flush()
        return {"id": row.id, "version": row.version}


# ------------------------------------------------------------
# Project files (multi-page site manifests)
# ------------------------------------------------------------

def get_project_files(project_id: str) -> list[dict]:
    """Returns all files for the project as a list of dicts, ordered by
    filename. Returns [] when no files exist (first build)."""
    with get_session() as session:
        rows = session.scalars(
            select(ProjectFile)
            .where(ProjectFile.project_id == project_id)
            .order_by(ProjectFile.filename)
        ).all()
    return [
        {"filename": r.filename, "purpose": r.purpose, "content": r.content}
        for r in rows
    ]


def upsert_project_files(project_id: str, files: list[dict]) -> None:
    """Merge a list of file dicts into project_files for this project.

    Each dict must have 'filename', 'purpose', 'content', and an optional
    'action' field ("create" | "update" | "delete"). Rows are inserted or
    updated on the unique (project_id, filename) constraint; delete rows
    are removed. Unchanged files that are not in `files` are left alone.
    """
    with get_session() as session:
        for f in files:
            action = f.get("action", "create")
            filename = f["filename"]

            existing = session.scalar(
                select(ProjectFile).where(
                    ProjectFile.project_id == project_id,
                    ProjectFile.filename == filename,
                )
            )

            if action == "delete":
                if existing:
                    session.delete(existing)
            elif existing:
                existing.purpose = f.get("purpose", existing.purpose)
                existing.content = f.get("content", existing.content)
            else:
                session.add(ProjectFile(
                    project_id=project_id,
                    filename=filename,
                    purpose=f.get("purpose", ""),
                    content=f.get("content", ""),
                ))


# ------------------------------------------------------------
# Jobs
# ------------------------------------------------------------

def create_job(customer_id: str, request_text: str, project_id: str | None = None) -> str:
    with get_session() as session:
        job = Job(customer_id=customer_id, project_id=project_id, request_text=request_text)
        session.add(job)
        session.flush()
        return job.id


def update_job_status(job_id: str, status: str, result: str | None = None, error: str | None = None) -> None:
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            return
        job.status = JobStatus(status)
        if result is not None:
            job.result = result
        if error is not None:
            job.error = error


def add_job_event(job_id: str, step_name: str, status: str, detail: dict | None = None) -> None:
    with get_session() as session:
        session.add(JobEvent(job_id=job_id, step_name=step_name, status=status, detail=detail))


def get_job(job_id: str) -> dict | None:
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            return None
        return {
            "id": job.id,
            "status": job.status.value,
            "result": job.result,
            "error": job.error,
            "created_at": job.created_at.isoformat() if isinstance(job.created_at, datetime) else job.created_at,
            "events": [
                {"step_name": e.step_name, "status": e.status, "detail": e.detail}
                for e in job.events
            ],
        }
