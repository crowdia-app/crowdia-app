-- Create organizer_requests table for users requesting to become an organizer
CREATE TABLE IF NOT EXISTS public.organizer_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_name text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.organizer_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own request
CREATE POLICY "Users can view own organizer request"
  ON public.organizer_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own request (only if no existing request)
CREATE POLICY "Users can submit organizer request"
  ON public.organizer_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all organizer requests"
  ON public.organizer_requests FOR SELECT
  USING (public.is_admin());

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update organizer requests"
  ON public.organizer_requests FOR UPDATE
  USING (public.is_admin());

-- Admins can delete requests
CREATE POLICY "Admins can delete organizer requests"
  ON public.organizer_requests FOR DELETE
  USING (public.is_admin());

-- Index for performance
CREATE INDEX IF NOT EXISTS organizer_requests_user_id_idx ON public.organizer_requests(user_id);
CREATE INDEX IF NOT EXISTS organizer_requests_status_idx ON public.organizer_requests(status);
