import { createClient } from '@supabase/supabase-js';

// Project ID extracted from: https://supabase.com/dashboard/project/iimstdtlwuenzyxuywvo
const PROJECT_ID = 'iimstdtlwuenzyxuywvo';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbXN0ZHRsd3Vlbnp5eHV5d3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NzEwNjIsImV4cCI6MjA4NjI0NzA2Mn0.9cxxDgi1LqTvn3t3t5i2sEMqPzlhhYY_1zZfaHI_eA0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);