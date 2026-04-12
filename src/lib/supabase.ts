import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lzyrubwtvpbvexugbevw.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G-6JTZ-TCLHnSMo4N1Os3w_32HkBTms';

export const supabase = createClient(supabaseUrl, supabaseKey);
