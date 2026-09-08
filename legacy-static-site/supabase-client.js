// AgenticCore Agency — Supabase client configuration
// This uses the publishable (anon) key, safe for browser use.
// Security is enforced by Row Level Security (RLS) rules on the database.

const SUPABASE_URL = 'https://ggyphnbnndfuxgkoakhs.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pVkYZGfKJdn_iIGHy1SaHQ_-QaR3iYw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
