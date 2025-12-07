-- Create table to manage WhatsApp templates
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  template_type text NOT NULL DEFAULT 'UTILITY', -- Always UTILITY, never MARKETING
  category text NOT NULL, -- 'delivery_notification' or 'satisfaction_survey'
  language text NOT NULL DEFAULT 'pt_BR',
  header_text text,
  body_text text NOT NULL,
  footer_text text,
  variables jsonb DEFAULT '[]'::jsonb, -- Array of variable definitions
  meta_template_id text, -- Template ID from Meta after submission
  meta_status text DEFAULT 'pending', -- pending, approved, rejected, in_review
  meta_rejection_reason text,
  submitted_at timestamp with time zone,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(template_name, language)
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can read templates"
ON public.whatsapp_templates
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert templates"
ON public.whatsapp_templates
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update templates"
ON public.whatsapp_templates
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete templates"
ON public.whatsapp_templates
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();