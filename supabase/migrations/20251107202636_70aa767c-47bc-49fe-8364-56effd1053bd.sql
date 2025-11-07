-- Create table to control survey send runs and enable cancellation
CREATE TABLE IF NOT EXISTS public.survey_send_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID,
  started_by UUID,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','cancelled','completed','failed')),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.survey_send_runs ENABLE ROW LEVEL SECURITY;

-- Basic policies (edge functions use service role and bypass RLS). Allow authenticated users to read their own runs and insert/update their own.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'allow_read_own_runs' AND tablename = 'survey_send_runs'
  ) THEN
    CREATE POLICY "allow_read_own_runs" ON public.survey_send_runs
    FOR SELECT USING (started_by IS NULL OR auth.uid() = started_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'allow_insert_own_runs' AND tablename = 'survey_send_runs'
  ) THEN
    CREATE POLICY "allow_insert_own_runs" ON public.survey_send_runs
    FOR INSERT WITH CHECK (started_by IS NULL OR auth.uid() = started_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'allow_update_own_runs' AND tablename = 'survey_send_runs'
  ) THEN
    CREATE POLICY "allow_update_own_runs" ON public.survey_send_runs
    FOR UPDATE USING (started_by IS NULL OR auth.uid() = started_by);
  END IF;
END $$;

-- Trigger to keep updated_at fresh (reuse existing function)
DROP TRIGGER IF EXISTS trg_survey_send_runs_updated_at ON public.survey_send_runs;
CREATE TRIGGER trg_survey_send_runs_updated_at
BEFORE UPDATE ON public.survey_send_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();