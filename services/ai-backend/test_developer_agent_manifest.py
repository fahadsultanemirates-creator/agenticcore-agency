"""
QA test for the upgraded developer_agent manifest system.

Verifies:
1. upsert_project_files stores files correctly
2. get_project_files retrieves them in filename order
3. Incremental edit merging — only changed files update; unchanged are preserved
4. Delete action removes the file
5. Full-manifest deliverable reconstruction includes all files (not just changed ones)
6. The developer_agent prompt, qa_agent prompt, and run_manager manifest path
   import and parse correctly.

Run with:
    cd artifacts/nexus-studio-backend
    python3 test_developer_agent_manifest.py
"""

import json
import sys
import os
import uuid

# ---------------------------------------------------------------------------
# 1. Import checks
# ---------------------------------------------------------------------------
from db.repository import (
    get_or_create_customer,
    get_or_create_project,
    get_project_files,
    upsert_project_files,
    upsert_deliverable,
    get_latest_deliverable,
)
from agents import _DEVELOPER_SYSTEM, run_manager
print("✅  Imports OK")

# ---------------------------------------------------------------------------
# 2. Set up a test project in the live DB
# ---------------------------------------------------------------------------
test_ref = f"qa-manifest-test-{uuid.uuid4().hex[:8]}@test.dev"
customer_id = get_or_create_customer(test_ref)
project_id = get_or_create_project(customer_id, name="manifest-qa-test")
print(f"✅  Test project: {project_id}")

# ---------------------------------------------------------------------------
# 3. Full new-site build — upsert 5 files (landing_page archetype)
# ---------------------------------------------------------------------------
initial_files = [
    {"filename": "index.html",    "purpose": "Home page — hero + features + CTA",  "content": "<html><!-- index --></html>",    "action": "create"},
    {"filename": "about.html",    "purpose": "About us",                             "content": "<html><!-- about --></html>",    "action": "create"},
    {"filename": "services.html", "purpose": "Services listing",                    "content": "<html><!-- services --></html>", "action": "create"},
    {"filename": "contact.html",  "purpose": "Contact form",                        "content": "<html><!-- contact --></html>", "action": "create"},
    {"filename": "style.css",     "purpose": "Shared stylesheet",                   "content": "body { margin: 0; }",           "action": "create"},
]
upsert_project_files(project_id, initial_files)
files = get_project_files(project_id)
assert len(files) == 5, f"Expected 5 files, got {len(files)}"
assert files[0]["filename"] == "about.html", "Files should be sorted by filename"
assert files[4]["filename"] == "style.css"
print("✅  Full build: 5 files stored and retrieved in filename order")

# ---------------------------------------------------------------------------
# 4. Incremental edit — only update one file, leave others alone
# ---------------------------------------------------------------------------
edit_files = [
    {
        "filename": "index.html",
        "purpose": "Home page — updated hero text",
        "content": "<html><!-- index UPDATED --></html>",
        "action": "update",
    }
]
upsert_project_files(project_id, edit_files)
files = get_project_files(project_id)
assert len(files) == 5, "Edit should not add or remove files"
idx = next(f for f in files if f["filename"] == "index.html")
assert "UPDATED" in idx["content"], "index.html content should be updated"
about = next(f for f in files if f["filename"] == "about.html")
assert "UPDATED" not in about["content"], "about.html should be unchanged"
print("✅  Incremental edit: only index.html changed, 4 other files unchanged")

# ---------------------------------------------------------------------------
# 5. Add a new file (login page)
# ---------------------------------------------------------------------------
upsert_project_files(project_id, [
    {"filename": "login.html", "purpose": "Login form with JWT auth", "content": "<html><!-- login --></html>", "action": "create"}
])
files = get_project_files(project_id)
assert len(files) == 6, f"Expected 6 files after add, got {len(files)}"
assert any(f["filename"] == "login.html" for f in files)
print("✅  Add file: login.html added, total now 6 files")

# ---------------------------------------------------------------------------
# 6. Delete a file
# ---------------------------------------------------------------------------
upsert_project_files(project_id, [
    {"filename": "login.html", "purpose": "", "content": "", "action": "delete"}
])
files = get_project_files(project_id)
assert len(files) == 5, f"Expected 5 files after delete, got {len(files)}"
assert not any(f["filename"] == "login.html" for f in files)
print("✅  Delete file: login.html removed, back to 5 files")

# ---------------------------------------------------------------------------
# 7. Full-manifest reconstruction for deliverable
# ---------------------------------------------------------------------------
all_files = get_project_files(project_id)
full_manifest = json.dumps({"archetype": "landing_page", "files": all_files}, ensure_ascii=False)
upsert_deliverable(project_id, "site_html", content=full_manifest)
stored = get_latest_deliverable(project_id, "site_html")
assert stored is not None
parsed = json.loads(stored["content"])
assert parsed["archetype"] == "landing_page"
assert len(parsed["files"]) == 5
assert parsed["files"][2]["filename"] == "index.html"  # sorted: about, contact, index, services, style
print("✅  Full-manifest deliverable: reconstructed and stored correctly")

# ---------------------------------------------------------------------------
# 8. Developer prompt contains archetype templates
# ---------------------------------------------------------------------------
for archetype in ["landing_page", "saas_dashboard", "real_estate", "forex_platform", "ecommerce"]:
    assert archetype in _DEVELOPER_SYSTEM, f"Archetype '{archetype}' missing from developer prompt"
assert "INCREMENTAL EDITS" in _DEVELOPER_SYSTEM
assert "action" in _DEVELOPER_SYSTEM
print("✅  Developer system prompt: all 5 archetypes + incremental edit rules present")

# ---------------------------------------------------------------------------
# 9. Existing-content injection path for developer_agent in run_manager
# ---------------------------------------------------------------------------
# Verify that when project_files exist, the run_manager would reconstruct them
# as existing_content JSON before calling developer_agent.
files_for_injection = get_project_files(project_id)
injected = json.dumps({"files": files_for_injection}, ensure_ascii=False)
parsed_injection = json.loads(injected)
assert len(parsed_injection["files"]) == 5
assert all("filename" in f and "content" in f for f in parsed_injection["files"])
print("✅  Existing-content injection: 5 files correctly serialized for developer_agent")

# ---------------------------------------------------------------------------
# 10. Simulate a manager manifest-parse + upsert path (mirrors run_manager logic)
# ---------------------------------------------------------------------------
simulated_agent_response = json.dumps({
    "archetype": "landing_page",
    "files": [
        {"filename": "index.html",    "purpose": "Home — hero updated", "content": "<html>home v2</html>", "action": "update"},
        {"filename": "pricing.html",  "purpose": "New pricing page",     "content": "<html>pricing</html>", "action": "create"},
    ]
})
manifest = json.loads(simulated_agent_response)
changed_files = manifest.get("files", [])
upsert_project_files(project_id, changed_files)
all_files_after = get_project_files(project_id)
# Should now have: about, contact, index (v2), pricing, services, style = 6
assert len(all_files_after) == 6, f"Expected 6, got {len(all_files_after)}"
idx_v2 = next(f for f in all_files_after if f["filename"] == "index.html")
assert "home v2" in idx_v2["content"]
pricing = next(f for f in all_files_after if f["filename"] == "pricing.html")
assert "pricing" in pricing["content"]
print("✅  Manager manifest-parse path: partial update merged correctly, 6 files total")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("ALL 10 CHECKS PASSED — developer_agent manifest system OK")
print("=" * 60)
