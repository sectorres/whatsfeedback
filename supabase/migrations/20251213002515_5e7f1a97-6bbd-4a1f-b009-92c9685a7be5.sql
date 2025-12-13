-- Add nickname column to whatsapp_templates table
ALTER TABLE public.whatsapp_templates 
ADD COLUMN nickname text;

-- Add comment explaining the column
COMMENT ON COLUMN public.whatsapp_templates.nickname IS 'Optional friendly name displayed in selection dropdowns instead of template_name';