import { 
  User, Project, Section, TestCase, TestRun, TestResult, HistoryLog, TestStep, Issue 
} from './types';
import { supabase } from './supabaseClient';

/**
 * [SUPABASE MIGRATION GUIDE]
 * 1. Supabase 대시보드에서 SQL 스크립트를 실행하여 테이블을 생성하세요.
 * 2. `supabaseClient.ts`에 URL과 Key를 입력하세요.
 * 3. 아래 `USE_SUPABASE` 상수를 true로 변경하세요.
 */
const USE_SUPABASE = false; 

const STORAGE_KEYS = {
  USERS: 'app_users',
  PROJECTS: 'app_projects',
  SECTIONS: 'app_sections',
  CASES: 'app_cases',
  RUNS: 'app_runs',
  RESULTS: 'app_results',
  HISTORY: 'app_history',
  CURRENT_USER: 'app_current_user',
};

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// --- Initial Seed Data (Only for LocalStorage) ---
const seedData = () => {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      const users: User[] = [
        { id: 'u1', name: '관리자(Admin)', email: 'admin@company.com', role: 'ADMIN', status: 'ACTIVE' },
        { id: 'u2', name: '김철수(QA)', email: 'jane@company.com', role: 'INTERNAL', status: 'ACTIVE' },
        { id: 'u3', name: '이영희(파트너)', email: 'ext