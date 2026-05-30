-- Fix voice_requests RLS policies to include super-admins
-- The original policies only checked is_admin(); super-admins (is_super_admin=true)
-- were excluded, preventing them from viewing or processing voice requests.

DROP POLICY IF EXISTS "voice_requests_select" ON public.voice_requests;
DROP POLICY IF EXISTS "voice_requests_update" ON public.voice_requests;

CREATE POLICY "voice_requests_select" ON public.voice_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin() OR public.is_super_admin());

CREATE POLICY "voice_requests_update" ON public.voice_requests
  FOR UPDATE USING (public.is_admin() OR public.is_super_admin());
