-- Atomic RPC to approve an organizer request:
--   1. Creates the organizer record
--   2. Marks the request approved with reviewer metadata
-- SECURITY DEFINER so it can write to both tables regardless of caller RLS
CREATE OR REPLACE FUNCTION public.approve_organizer_request(
  request_id_param UUID,
  reviewer_id_param UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req       organizer_requests%ROWTYPE;
  org_id    UUID;
BEGIN
  -- Fetch the request (raises if not found)
  SELECT * INTO STRICT req
  FROM organizer_requests
  WHERE id = request_id_param AND status = 'pending';

  -- Create the organizer record
  INSERT INTO organizers (organization_name, user_id, is_verified)
  VALUES (req.organization_name, req.user_id, false)
  RETURNING id INTO org_id;

  -- Mark request approved
  UPDATE organizer_requests
  SET
    status       = 'approved',
    reviewed_by  = reviewer_id_param,
    reviewed_at  = now(),
    updated_at   = now()
  WHERE id = request_id_param;

  RETURN org_id;
END;
$$;

COMMENT ON FUNCTION public.approve_organizer_request IS
  'Atomically creates an organizer from a pending request and marks it approved.';
