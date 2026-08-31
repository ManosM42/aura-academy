// src/lib/supabase.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabase as generatedClient } from "@/integrations/supabase/client";

/**
 * ΜΙΑ μόνο instance Supabase για όλη την εφαρμογή.
 *
 * Πριν υπήρχαν δύο: αυτό το αρχείο έφτιαχνε δικό του client με
 * VITE_SUPABASE_ANON_KEY + localStorage, ενώ το generated client
 * χρησιμοποιεί VITE_SUPABASE_PUBLISHABLE_KEY + brokeredPreviewStorage()
 * (απαραίτητο μέσα στο preview iframe). Αποτέλεσμα: το session της Google
 * γραφόταν στον έναν και το /checkout διάβαζε τον άλλον.
 *
 * Το cast υπάρχει επειδή το generated client είναι τυποποιημένο με το
 * ./integrations/supabase/types, ενώ τα queries.ts βασίζονται στο
 * @/lib/database.types. Το ίδιο σχήμα, δύο generated αρχεία.
 */
export const supabase = generatedClient as unknown as SupabaseClient<Database>;