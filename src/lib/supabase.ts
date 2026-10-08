import { createClient } from "@supabase/supabase-js";

// The publishable (anon) key, safe in the browser: every table this reaches
// is guarded by row-level security, so the key grants nothing a signed-out
// visitor should not already have.
//
// Hard-coded rather than read from import.meta.env, matching the legacy
// public/supabase-client.js it replaces. A build-time env var would add a
// way for a deploy to go out pointed at nothing, and these two values are
// public by nature.
const SUPABASE_URL = "https://ggyphnbnndfuxgkoakhs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pVkYZGfKJdn_iIGHy1SaHQ_-QaR3iYw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
