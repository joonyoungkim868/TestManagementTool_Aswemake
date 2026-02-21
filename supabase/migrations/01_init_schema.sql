-- Drop valid existing tables if necessary (Dangerous in prod, but safe for fresh start)
DROP TABLE IF EXISTS "testResults" CASCADE;
DROP TABLE IF EXISTS "testRuns" CASCADE;
DROP TABLE IF EXISTS "testCases" CASCADE;
DROP TABLE IF EXISTS "sections" CASCADE;
DROP TABLE IF EXISTS "documents" CASCADE;
DROP TABLE IF EXISTS "folders" CASCADE;
DROP TABLE IF EXISTS "historyLogs" CASCADE;
-- Users table is usually managed by Supabase Auth, but if using custom table:
-- DROP TABLE IF EXISTS users CASCADE; 

-- 1. Users (Helper table if not using built-in Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'INTERNAL', 
  status TEXT DEFAULT 'ACTIVE'
);

-- 2. Folders (Recursive)
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  desc TEXT,
  "parentId" UUID REFERENCES folders(id) ON DELETE CASCADE, 
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_folders_parent ON folders("parentId");

-- 3. Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "folderId" UUID REFERENCES folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Sections
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "parentId" UUID, -- Nested logic can be implemented later
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. TestCases
CREATE TABLE "testCases" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID REFERENCES documents(id) ON DELETE CASCADE,
  "sectionId" UUID REFERENCES sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  precondition TEXT,
  steps JSONB DEFAULT '[]',
  priority TEXT DEFAULT 'MEDIUM',
  type TEXT DEFAULT 'FUNCTIONAL',
  "authorId" UUID REFERENCES users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  seq_id SERIAL,
  note TEXT,
  platform_type TEXT DEFAULT 'WEB'
);

-- 6. TestRuns
CREATE TABLE "testRuns" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'OPEN', 
  "target_document_ids" JSONB DEFAULT '[]', 
  phase TEXT,
  assignees JSONB DEFAULT '[]', 
  snapshot_data JSONB, 
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "completedAt" TIMESTAMP WITH TIME ZONE
);

-- 7. TestResults
CREATE TABLE "testResults" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" UUID REFERENCES "testRuns"(id) ON DELETE CASCADE,
  "caseId" UUID REFERENCES "testCases"(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'UNTESTED',
  "actualResult" TEXT,
  comment TEXT,
  issues JSONB DEFAULT '[]', 
  "stepResults" JSONB DEFAULT '[]',
  "device_platform" TEXT DEFAULT 'PC',
  "testerId" UUID REFERENCES users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  history JSONB DEFAULT '[]'
);

-- 8. HistoryLogs
CREATE TABLE "historyLogs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entityType" TEXT,
  "entityId" UUID,
  action TEXT,
  "modifierId" UUID REFERENCES users(id),
  "modifierName" TEXT,
  changes JSONB DEFAULT '[]',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 9. [Recursive Function] Get all document IDs under a folder (N-Depth)
CREATE OR REPLACE FUNCTION get_recursive_document_ids(target_folder_id UUID)
RETURNS TABLE (doc_id UUID) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE folder_tree AS (
        -- Base case: the target folder itself
        SELECT id FROM folders WHERE id = target_folder_id
        UNION ALL
        -- Recursive case: children of folders in the tree
        SELECT f.id FROM folders f
        INNER JOIN folder_tree ft ON f."parentId" = ft.id
    )
    SELECT d.id FROM documents d
    WHERE d."folderId" IN (SELECT id FROM folder_tree);
END;
$$ LANGUAGE plpgsql;
