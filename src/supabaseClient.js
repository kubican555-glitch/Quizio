import { createClient } from '@supabase/supabase-js';

// Doplň své údaje ze Supabase Settings -> API
const supabaseUrl = 'https://yvqbxlannhzwrvglupdu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2cWJ4bGFubmh6d3J2Z2x1cGR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NzA4NDcsImV4cCI6MjA4MTA0Njg0N30.ZzosU0U6KSmJMWptxy_IrWagmAp7Gv3H0B_wASHuZRw';

export const supabase = createClient(supabaseUrl, supabaseKey);