-- Atomically merge document metadata while preserving the tenant boundary.
-- Only trusted server-side service-role callers may execute this function.
CREATE OR REPLACE FUNCTION public.merge_document_metadata(
  p_document_id UUID,
  p_organization_id UUID,
  p_patch JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  UPDATE public.documents
  SET metadata = COALESCE(metadata, '{}'::jsonb) || p_patch
  WHERE id = p_document_id
    AND organization_id = p_organization_id
  RETURNING metadata INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_document_metadata(UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_document_metadata(UUID, UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.merge_document_metadata(UUID, UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_document_metadata(UUID, UUID, JSONB) TO service_role;
