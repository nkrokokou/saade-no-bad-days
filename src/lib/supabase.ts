import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sgqwohapgtkcalduhuqu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncXdvaGFwZ3RrY2FsZHVodXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzEwNDUsImV4cCI6MjA5MTMwNzA0NX0.VAgBIGgUSfmlWrNKVoLXPBnZm1za47GaTwI3Z6wppW0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
