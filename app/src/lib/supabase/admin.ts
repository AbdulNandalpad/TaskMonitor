import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server only: used for audit_log writes and nothing the browser can reach. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
