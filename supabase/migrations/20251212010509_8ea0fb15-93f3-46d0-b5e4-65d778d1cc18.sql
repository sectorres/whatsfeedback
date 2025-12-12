-- Create table for AI trigger phrases
CREATE TABLE public.ai_trigger_phrases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phrase TEXT NOT NULL,
  response TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact', 'starts_with')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_trigger_phrases ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view trigger phrases" 
ON public.ai_trigger_phrases 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert trigger phrases" 
ON public.ai_trigger_phrases 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update trigger phrases" 
ON public.ai_trigger_phrases 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete trigger phrases" 
ON public.ai_trigger_phrases 
FOR DELETE 
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_trigger_phrases_updated_at
BEFORE UPDATE ON public.ai_trigger_phrases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();