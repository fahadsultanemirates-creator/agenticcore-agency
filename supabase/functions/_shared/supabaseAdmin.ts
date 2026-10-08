// The service-role client, in one place.
//
// Every function here was building its own, which is four copies of the
// same two env reads and four chances for one of them to be built with
// the anon key by accident.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
