-- Add is_disabled column to whatsapp_templates table
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;