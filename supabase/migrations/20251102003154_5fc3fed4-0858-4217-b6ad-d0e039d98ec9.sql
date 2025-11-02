-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create module enum for different sections of the app
CREATE TYPE public.app_module AS ENUM (
  'dashboard_stats',
  'conversations',
  'campaigns',
  'satisfaction_surveys',
  'order_status',
  'whatsapp_connection',
  'ip_whitelist',
  'send_delay_config',
  'api_config',
  'webhook_config',
  'change_password'
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_modules table (maps users to allowed modules)
CREATE TABLE public.user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Security definer function to check if user has access to a module
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module public.app_module)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin(_user_id) OR 
    EXISTS (
      SELECT 1 
      FROM public.user_modules 
      WHERE user_id = _user_id AND module = _module
    )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- RLS Policies for user_modules
CREATE POLICY "Users can view their own modules"
  ON public.user_modules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all modules"
  ON public.user_modules FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert modules"
  ON public.user_modules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete modules"
  ON public.user_modules FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Trigger to give admins all modules automatically
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    -- Insert all modules for admin
    INSERT INTO public.user_modules (user_id, module)
    SELECT NEW.user_id, unnest(enum_range(NULL::public.app_module))
    ON CONFLICT (user_id, module) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_admin_role_created
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_admin();