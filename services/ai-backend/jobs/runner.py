"""
Background job execution.

Lightweight, DB-backed: a job is a row in `jobs` (see db/models.py) plus a
stream of `job_events` recording its progress. Execution itself runs
in-process via FastAPI's BackgroundTasks — the same mechanism main.py
already uses for the Telegram webhook. No separate worker process or
queue infra; if throughput ever requires it, the DB schema here can move
under a real queue (Celery/RQ) without changing its shape.
"""

import json
import logging

from db.repository import add_job_event, create_job, update_job_status

logger = logging.getLogger("agenticcore-agency.jobs")


def _serialize(result) -> str:
    if isinstance(result, str):
        return result
    return json.dumps(result)


def run_job(job_id: str, fn, *args, **kwargs) -> None:
    """Runs fn(*args, on_event=..., **kwargs) and tracks its lifecycle in
    the DB. fn may call the supplied on_event(step_name, status, detail)
    callback to record progress on multi-step work; it's optional — fn
    isn't required to accept it if the caller doesn't pass on_event through.
    """
    update_job_status(job_id, "running")
    add_job_event(job_id, "job", "started")
    try:
        def on_event(step_name: str, status: str, detail: dict | None = None):
            add_job_event(job_id, step_name, status, detail)

        result = fn(*args, on_event=on_event, **kwargs)
        update_job_status(job_id, "succeeded", result=_serialize(result))
        add_job_event(job_id, "job", "succeeded")
    except Exception as e:
        logger.exception(f"Job {job_id} failed")
        update_job_status(job_id, "failed", error=str(e))
        add_job_event(job_id, "job", "failed", detail={"error": str(e)})


def create_and_run_job(background_tasks, customer_id: str, request_text: str, fn, *args,
                        project_id: str | None = None, fn_kwargs: dict | None = None) -> str:
    """Creates a job row and schedules its execution in the background.
    Returns the job_id immediately so the caller can respond to the
    client right away and let it poll GET /api/jobs/{job_id}.

    fn_kwargs (rather than **kwargs) is deliberate: it keeps fn's own
    argument names from ever colliding with this function's own
    (customer_id, project_id, ...) bookkeeping parameters.
    """
    job_id = create_job(customer_id, request_text, project_id=project_id)
    background_tasks.add_task(run_job, job_id, fn, *args, **(fn_kwargs or {}))
    return job_id
