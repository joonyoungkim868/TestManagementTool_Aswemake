import { createClient } from '@supabase/supabase-js';

// TODO: Supabase 프로젝트 설정 후 아래 값을 본인의 키로 교체하세요.
// Settings > API 메뉴에서 확인 가능합니다.
const SUPABASE_URL = 'https://supabase.com/dashboard/project/iimstdtlwuenzyxuywvo';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbXN0ZHRsd3Vlbnp5eHV5d3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NzEwNjIsImV4cCI6MjA4NjI0NzA2Mn0.9cxxDgi1LqTvn3t3t5i2sEMqPzlhhYY_1zZfaHI_eA0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
