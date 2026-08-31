import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Οι τιμές έρχονται από το .env (Vite → πρόθεμα VITE_).
// Lovable/Vite convention:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Λείπουν οι μεταβλητές VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Έλεγξε το αρχείο .env στη ρίζα του project και κάνε restart τον dev server.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // χρειάζεται για το Google OAuth redirect
  },
});