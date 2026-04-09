import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sgqwohapgtkcalduhuqu.supabase.co';
const supabaseAnonKey = '__SUPABASE_ANON_KEY_REDACTED__';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
