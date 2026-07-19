-- Enforce the document tenant boundary below the service-role application
-- layer. A request/record may reference only a document in the same org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_org_id_unique
  ON public.documents(organization_id, id);

ALTER TABLE public.esignature_requests
  DROP CONSTRAINT IF EXISTS esignature_requests_document_tenant_fkey;
ALTER TABLE public.esignature_requests
  ADD CONSTRAINT esignature_requests_document_tenant_fkey
  FOREIGN KEY (organization_id, document_id)
  REFERENCES public.documents(organization_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.esignature_records
  DROP CONSTRAINT IF EXISTS esignature_records_document_tenant_fkey;
ALTER TABLE public.esignature_records
  ADD CONSTRAINT esignature_records_document_tenant_fkey
  FOREIGN KEY (organization_id, document_id)
  REFERENCES public.documents(organization_id, id)
  ON DELETE CASCADE
  NOT VALID;
