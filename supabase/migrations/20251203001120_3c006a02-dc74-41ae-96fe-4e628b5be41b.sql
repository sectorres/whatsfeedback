-- Create table for Evolution API configurations
CREATE TABLE public.evolution_api_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_type TEXT NOT NULL DEFAULT 'unofficial', -- 'unofficial' or 'official'
  api_url TEXT,
  api_key TEXT,
  instance_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolution_api_config ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write (single tenant app)
CREATE POLICY "Allow all operations for authenticated users" 
ON public.evolution_api_config 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_evolution_api_config_updated_at
BEFORE UPDATE ON public.evolution_api_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config (unofficial - uses secrets)
INSERT INTO public.evolution_api_config (config_type, is_active)
VALUES ('unofficial', true);