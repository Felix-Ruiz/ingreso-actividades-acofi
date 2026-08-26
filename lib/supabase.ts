import { createClient } from '@supabase/supabase-js';

// Durante la fase de "build" en Vercel, es posible que las variables tarden en inyectarse.
// Usamos un 'fallback' o placeholder temporal para que Next.js no rompa la compilación.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn("Advertencia de Construcción: Las variables de entorno de Supabase no están presentes. Se usarán placeholders temporales para el Build.");
}

// Exportamos una única instancia del cliente para usarla en toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);