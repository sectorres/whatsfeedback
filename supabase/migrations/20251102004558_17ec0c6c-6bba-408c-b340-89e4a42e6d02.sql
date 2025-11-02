-- Add new module values to existing enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'dashboard';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'atendimento';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'orders';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'config';