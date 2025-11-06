-- Fix RLS policies for all business tables
-- Replace 'Allow all access' policies with authentication-based policies

-- ========================================
-- CAMPAIGNS TABLE
-- ========================================
DROP POLICY IF EXISTS "Allow all access to campaigns" ON campaigns;

CREATE POLICY "Authenticated users can read campaigns"
ON campaigns FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert campaigns"
ON campaigns FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update campaigns"
ON campaigns FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete campaigns"
ON campaigns FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ========================================
-- CAMPAIGN_SENDS TABLE
-- ========================================
DROP POLICY IF EXISTS "Allow all access to campaign_sends" ON campaign_sends;

CREATE POLICY "Authenticated users can read campaign_sends"
ON campaign_sends FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert campaign_sends"
ON campaign_sends FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update campaign_sends"
ON campaign_sends FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete campaign_sends"
ON campaign_sends FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ========================================
-- CONVERSATIONS TABLE
-- ========================================
DROP POLICY IF EXISTS "Allow all access to conversations" ON conversations;

CREATE POLICY "Authenticated users can read conversations"
ON conversations FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert conversations"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update conversations"
ON conversations FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete conversations"
ON conversations FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ========================================
-- MESSAGES TABLE
-- ========================================
DROP POLICY IF EXISTS "Allow all access to messages" ON messages;

CREATE POLICY "Authenticated users can read messages"
ON messages FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update messages"
ON messages FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete messages"
ON messages FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ========================================
-- BLACKLIST TABLE
-- ========================================
DROP POLICY IF EXISTS "Allow all access to blacklist" ON blacklist;

CREATE POLICY "Authenticated users can read blacklist"
ON blacklist FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert blacklist"
ON blacklist FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update blacklist"
ON blacklist FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete blacklist"
ON blacklist FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ========================================
-- SATISFACTION_SURVEYS TABLE
-- ========================================
DROP POLICY IF EXISTS "Allow all access to satisfaction_surveys" ON satisfaction_surveys;

CREATE POLICY "Authenticated users can read satisfaction_surveys"
ON satisfaction_surveys FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert satisfaction_surveys"
ON satisfaction_surveys FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update satisfaction_surveys"
ON satisfaction_surveys FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete satisfaction_surveys"
ON satisfaction_surveys FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ========================================
-- SATISFACTION_INSIGHTS TABLE
-- ========================================
DROP POLICY IF EXISTS "Allow all access to satisfaction_insights" ON satisfaction_insights;

CREATE POLICY "Authenticated users can read satisfaction_insights"
ON satisfaction_insights FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert satisfaction_insights"
ON satisfaction_insights FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update satisfaction_insights"
ON satisfaction_insights FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete satisfaction_insights"
ON satisfaction_insights FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ========================================
-- ALLOWED_IPS TABLE
-- ========================================
-- Note: This table already has proper RLS policies, no changes needed