# jobs/

Each `jobs/AC-AGENCY-XXXX/` folder here is committed automatically by
`telegram-webhook` after `/approve` generates a first draft (or a
draft-patch regenerates one) for a **website**-type manager task. The
bot splits the draft's `=== filename ===` blocks into real files and
commits them straight to `main` — there's no PR step for this, so what
lands here is live the moment the commit succeeds.

Non-website tasks (design, marketing, bookkeeping, etc.) never produce a
`jobs/` folder — their drafts are plain Markdown with no files to split.

## Deploying a job as its own site (manual, one-time per job)

Netlify supports multiple sites from one repo, each pointing at a
different base directory. There's no API call in this slice that
creates the Netlify site for you — do this once per job, after its
first commit has landed under `jobs/AC-AGENCY-XXXX/`:

1. Netlify dashboard → **Add new site → Import an existing project**.
2. Connect the same GitHub repo (`fahadsultanemirates-creator/agenticcore-agency`).
3. Under **Build settings**:
   - **Base directory**: `jobs/AC-AGENCY-XXXX` (the exact job folder)
   - **Build command**: leave empty — these are plain static files, no build step
   - **Publish directory**: `.` (i.e. the base directory itself)
4. Deploy. Netlify assigns a random subdomain
   (`something-random.netlify.app`); rename it under **Site settings →
   Site information**, or attach a custom domain, once the client
   deliverable is ready to hand over.

Setting **Base directory** also gets you automatic deploy-skipping for
free: Netlify only rebuilds this job's site when a commit actually
touches files under that directory, so other jobs' commits (and commits
to the main marketing site) won't trigger a rebuild here.

### If you'd rather configure it as a file instead of dashboard clicks

Drop this at `jobs/AC-AGENCY-XXXX/netlify.toml` (after the job's first
commit exists, as a follow-up commit) and link the site the same way as
step 1–2 above, still with **Base directory** set to that job's folder:

```toml
[build]
  publish = "."
```

### One-off manual deploy via the CLI, instead of continuous git deploys

```
netlify deploy --prod --dir=jobs/AC-AGENCY-XXXX --site=<site-id>
```

(`<site-id>` is the Netlify site's API ID, found under **Site settings
→ General → Site details** once the site exists.)

## Worth checking: does this affect the main site's deploys?

The main agenticcore.agency site is also built from this repo's `main`
branch. If its Netlify project has no **Base directory** set (build
scoped to the whole repo), every job-folder commit will also trigger a
rebuild of the main site — harmless for a static site with instant
builds, but worth knowing. To scope it out, set an **Ignore build**
command on the main site (Build & deploy → Build settings):

```
git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ':!jobs'
```

(exits 0 — "nothing outside jobs/ changed" — to skip that build).
