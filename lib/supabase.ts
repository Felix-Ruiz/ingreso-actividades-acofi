import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Exportamos una única instancia del cliente para usarla en toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);