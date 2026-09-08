"""
Regression test — Task #41: Targeted edits change only what was asked.

Three-round session:
  Round 1 — initial build: 3-page site (index.html, about.html, contact.html)
             + style.css. Simulates developer_agent returning a full manifest.
  Round 2 — edit: customer asks to change the hero heading in index.html.
             Simulates developer_agent returning ONLY the changed index.html.
             Asserts: index.html updated, about.html/contact.html/style.css UNTOUCHED.
  Round 3 — edit: customer asks to update the footer email in contact.html.
             Simulates developer_agent returning ONLY the changed contact.html.
             Asserts: contact.html updated, index.html retains Round 2 heading,
             about.html/style.css still untouched.

Also verifies:
  - _build_project_context returns correct file list when files exist
  - _build_project_context returns "" when no files exist (new customer)
  - Manifest deliverable reflects the full site (merged, not just the delta)

Run with:
    cd artifacts/nexus-studio-backend
    python3 test_targeted_edits.py
"""

import json
import sys
import uuid

from db.repository import (
    get_or_create_customer,
    get_or_create_project,
    get_project_files,
    upsert_project_files,
    upsert_deliverable,
    get_latest_deliverable,
)
from agents import _build_project_context, _DEVELOPER_SYSTEM

print("=" * 65)
print("Task #41 Regression Test — Targeted Edits")
print("=" * 65)

# ---------------------------------------------------------------------------
# Setup — fresh isolated project so this test is idempotent
# ---------------------------------------------------------------------------
ref = f"targeted-edit-test-{uuid.uuid4().hex[:8]}@test.dev"
cid = get_or_create_customer(ref)
pid = get_or_create_project(cid, name="targeted-edit-regression")
print(f"\n✅  Setup: project_id={pid[:8]}…")

# ---------------------------------------------------------------------------
# HELPER: simulate the run_manager manifest-parse + upsert pipeline
# (mirrors the developer_agent branch in run_manager exactly)
# ---------------------------------------------------------------------------
def apply_developer_agent_result(project_id: str, agent_json_result: str) -> list[dict]:
    """Applies a developer_agent JSON result: upserts changed files, returns
    the full manifest (all files) from DB after the merge."""
    manifest = json.loads(agent_json_result)
    changed_files = manifest.get("files", [])
    upsert_project_files(project_id, changed_files)
    return get_project_files(project_id)

# ---------------------------------------------------------------------------
# Round 0: _build_project_context returns "" for a brand-new project
# ---------------------------------------------------------------------------
ctx_empty = _build_project_context(pid)
assert ctx_empty == "", f"Expected empty context for new project, got: {ctx_empty!r}"
print("✅  Round 0: _build_project_context returns '' for project with no files")

# ---------------------------------------------------------------------------
# Round 1: Initial full build — developer_agent returns 4 files
# ---------------------------------------------------------------------------
INITIAL_HERO = "Build the future with AI"
INITIAL_FOOTER_EMAIL = "contact@old-domain.com"

round1_result = json.dumps({
    "archetype": "landing_page",
    "files": [
        {
            "filename": "index.html",
            "purpose": "Home page — hero + features + CTA",
            "content": f"<html><body><h1>{INITIAL_HERO}</h1></body></html>",
            "action": "create",
        },
        {
            "filename": "about.html",
            "purpose": "About us",
            "content": "<html><body><h1>About Us</h1></body></html>",
            "action": "create",
        },
        {
            "filename": "contact.html",
            "purpose": "Contact form",
            "content": f"<html><body><p>Email: {INITIAL_FOOTER_EMAIL}</p></body></html>",
            "action": "create",
        },
        {
            "filename": "style.css",
            "purpose": "Shared stylesheet",
            "content": "body { font-family: sans-serif; margin: 0; }",
            "action": "create",
        },
    ],
})

all_files = apply_developer_agent_result(pid, round1_result)

assert len(all_files) == 4, f"Round 1: expected 4 files, got {len(all_files)}"
assert any(f["filename"] == "index.html" and INITIAL_HERO in f["content"] for f in all_files)
assert any(f["filename"] == "about.html" for f in all_files)
assert any(f["filename"] == "contact.html" and INITIAL_FOOTER_EMAIL in f["content"] for f in all_files)
assert any(f["filename"] == "style.css" for f in all_files)

# Save deliverable (as run_manager does)
full_manifest_r1 = json.dumps({"archetype": "landing_page", "files": all_files})
upsert_deliverable(pid, "site_html", content=full_manifest_r1)

print("✅  Round 1: Full build — 4 files stored correctly")
print(f"     • index.html: hero = '{INITIAL_HERO}'")
print(f"     • contact.html: email = '{INITIAL_FOOTER_EMAIL}'")

# ---------------------------------------------------------------------------
# Round 1b: _build_project_context now returns a populated file list
# ---------------------------------------------------------------------------
ctx = _build_project_context(pid)
assert "index.html" in ctx
assert "about.html" in ctx
assert "contact.html" in ctx
assert "style.css" in ctx
assert "EXISTING PROJECT" in ctx
assert "EDITS" in ctx or "edit" in ctx.lower(), "Context must mention edit routing rules"
print("✅  Round 1b: _build_project_context lists all 4 files + routing rules")

# ---------------------------------------------------------------------------
# Round 2: Edit — customer says "Change hero heading to 'Your AI Partner'"
# Developer_agent returns ONLY index.html (targeted edit)
# ---------------------------------------------------------------------------
NEW_HERO = "Your AI Partner"

round2_result = json.dumps({
    "archetype": "landing_page",
    "files": [
        {
            "filename": "index.html",
            "purpose": "Home page — hero heading updated",
            "content": f"<html><body><h1>{NEW_HERO}</h1></body></html>",
            "action": "update",
        }
        # about.html, contact.html, style.css are NOT included — targeted edit
    ],
})

all_files = apply_developer_agent_result(pid, round2_result)

assert len(all_files) == 4, f"Round 2: file count should still be 4, got {len(all_files)}"

idx = next(f for f in all_files if f["filename"] == "index.html")
assert NEW_HERO in idx["content"], f"index.html should have new hero: {idx['content']}"
assert INITIAL_HERO not in idx["content"], "Old hero text should be gone from index.html"

about = next(f for f in all_files if f["filename"] == "about.html")
assert "About Us" in about["content"], "about.html must be unchanged"

contact = next(f for f in all_files if f["filename"] == "contact.html")
assert INITIAL_FOOTER_EMAIL in contact["content"], "contact.html must be unchanged in Round 2"

css = next(f for f in all_files if f["filename"] == "style.css")
assert "sans-serif" in css["content"], "style.css must be unchanged"

# Deliverable reflects full merged site
full_manifest_r2 = json.dumps({"archetype": "landing_page", "files": all_files})
upsert_deliverable(pid, "site_html", content=full_manifest_r2)
stored = get_latest_deliverable(pid, "site_html")
parsed = json.loads(stored["content"])
assert len(parsed["files"]) == 4
assert any(f["filename"] == "index.html" and NEW_HERO in f["content"] for f in parsed["files"])

print("✅  Round 2: Hero edit — only index.html changed")
print(f"     • index.html: hero = '{NEW_HERO}' (updated)")
print( "     • about.html, contact.html, style.css: unchanged ✓")
print( "     • Deliverable reflects full 4-file merged manifest ✓")

# ---------------------------------------------------------------------------
# Round 3: Edit — customer says "Update contact email to hello@acme.com"
# Developer_agent returns ONLY contact.html (targeted edit)
# ---------------------------------------------------------------------------
NEW_EMAIL = "hello@acme.com"

round3_result = json.dumps({
    "archetype": "landing_page",
    "files": [
        {
            "filename": "contact.html",
            "purpose": "Contact form — email updated to hello@acme.com",
            "content": f"<html><body><p>Email: {NEW_EMAIL}</p></body></html>",
            "action": "update",
        }
        # index.html, about.html, style.css are NOT included
    ],
})

all_files = apply_developer_agent_result(pid, round3_result)

assert len(all_files) == 4, f"Round 3: file count should still be 4, got {len(all_files)}"

contact = next(f for f in all_files if f["filename"] == "contact.html")
assert NEW_EMAIL in contact["content"], f"contact.html should have new email: {contact['content']}"
assert INITIAL_FOOTER_EMAIL not in contact["content"], "Old email should be gone"

# index.html must still have Round 2's hero (not reverted to Round 1)
idx = next(f for f in all_files if f["filename"] == "index.html")
assert NEW_HERO in idx["content"], f"index.html must retain Round 2 hero, got: {idx['content']}"
assert INITIAL_HERO not in idx["content"], "Round 1 hero must not reappear"

about = next(f for f in all_files if f["filename"] == "about.html")
assert "About Us" in about["content"], "about.html must remain unchanged"

css = next(f for f in all_files if f["filename"] == "style.css")
assert "sans-serif" in css["content"], "style.css must remain unchanged"

# Deliverable reflects full merged site with both edits applied
full_manifest_r3 = json.dumps({"archetype": "landing_page", "files": all_files})
upsert_deliverable(pid, "site_html", content=full_manifest_r3)
stored = get_latest_deliverable(pid, "site_html")
parsed = json.loads(stored["content"])
idx_stored = next(f for f in parsed["files"] if f["filename"] == "index.html")
contact_stored = next(f for f in parsed["files"] if f["filename"] == "contact.html")
assert NEW_HERO in idx_stored["content"], "Deliverable must contain Round 2 hero"
assert NEW_EMAIL in contact_stored["content"], "Deliverable must contain Round 3 email"
assert INITIAL_HERO not in idx_stored["content"]
assert INITIAL_FOOTER_EMAIL not in contact_stored["content"]

print("✅  Round 3: Email edit — only contact.html changed")
print(f"     • contact.html: email = '{NEW_EMAIL}' (updated)")
print(f"     • index.html: hero still '{NEW_HERO}' from Round 2 ✓")
print( "     • about.html, style.css: unchanged ✓")
print( "     • Deliverable reflects both Round 2 + Round 3 edits ✓")

# ---------------------------------------------------------------------------
# Developer prompt checks
# ---------------------------------------------------------------------------
assert "INCREMENTAL EDITS" in _DEVELOPER_SYSTEM
assert "EXAMPLE" in _DEVELOPER_SYSTEM, "Prompt must include a concrete example"
assert "NEVER DO THIS" in _DEVELOPER_SYSTEM, "Prompt must call out the bad pattern"
assert "action" in _DEVELOPER_SYSTEM
print("✅  Developer prompt: INCREMENTAL EDITS section, concrete example, and anti-pattern warning present")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print()
print("=" * 65)
print("ALL CHECKS PASSED — Targeted edit framework works correctly")
print("  • Round 1 (full build): 4 files stored")
print(f"  • Round 2 (hero edit):  only index.html updated, 3 files untouched")
print(f"  • Round 3 (email edit): only contact.html updated, Round 2 edits preserved")
print("=" * 65)
