import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pqfofbniphvkkdscpdem.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZm9mYm5pcGh2a2tkc2NwZGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0OTIzODIsImV4cCI6MjA2MzA2ODM4Mn0.YhA7wXqI5-b2YM9A5QPKHf13nhx2fTj9PotVT_2Q92Q"; // Replace with actual key in quotes
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
