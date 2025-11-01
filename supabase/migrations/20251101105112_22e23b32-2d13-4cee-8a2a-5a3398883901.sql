-- Create table for allowed IP addresses
CREATE TABLE public.allowed_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.allowed_ips ENABLE ROW LEVEL SECURITY;

-- Create policies for allowed_ips (only authenticated users can view/manage)
CREATE POLICY "Authenticated users can view allowed IPs" 
ON public.allowed_ips 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert allowed IPs" 
ON public.allowed_ips 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update allowed IPs" 
ON public.allowed_ips 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete allowed IPs" 
ON public.allowed_ips 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_allowed_ips_updated_at
BEFORE UPDATE ON public.allowed_ips
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert the main IPs
INSERT INTO public.allowed_ips (ip_address, description) VALUES
  ('191.209.57.46', 'IP Principal 1'),
  ('187.84.33.15', 'IP Principal 2');