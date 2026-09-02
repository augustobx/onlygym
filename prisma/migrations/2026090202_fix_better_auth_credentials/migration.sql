-- Normalize existing Better Auth credential accounts and enforce the shape Better Auth expects.
UPDATE "account"
SET
  "accountId" = "userId",
  "issuer" = 'local:credential'
WHERE "providerId" = 'credential';

CREATE OR REPLACE FUNCTION onlygym_normalize_credential_account()
RETURNS trigger AS $$
BEGIN
  IF NEW."providerId" = 'credential' THEN
    NEW."accountId" := NEW."userId";
    NEW."issuer" := 'local:credential';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onlygym_normalize_credential_account_trigger ON "account";

CREATE TRIGGER onlygym_normalize_credential_account_trigger
BEFORE INSERT OR UPDATE ON "account"
FOR EACH ROW
EXECUTE FUNCTION onlygym_normalize_credential_account();
