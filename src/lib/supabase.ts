import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hvuhsncmafoyfyandkdu.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_xVV3nO8JOf_uaSLjAieXQg_7VEMQ4jz';

export const supabase = createClient(supabaseUrl, supabaseKey);
