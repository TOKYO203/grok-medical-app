-- Enforce the Premium commerce state machine at the database boundary.
-- This protects the order even if two application requests race or a future caller bypasses UI checks.
-- Refund + linked-license revocation + audit are executed atomically by the server CTE.

CREATE OR REPLACE FUNCTION guard_purchase_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'created' AND NEW.status = 'instructions_requested')
     OR (OLD.status = 'instructions_requested' AND NEW.status = 'proof_ready')
     OR (OLD.status = 'proof_ready' AND NEW.status = 'verification_pending')
     OR (OLD.status = 'verification_pending' AND NEW.status = 'payment_verified')
     OR (OLD.status = 'payment_verified' AND NEW.status = 'delivered')
     OR (OLD.status = 'delivered' AND NEW.status = 'refunded')
     OR (
       NEW.status = 'rejected'
       AND OLD.status IN (
         'created',
         'instructions_requested',
         'proof_ready',
         'verification_pending',
         'payment_verified'
       )
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid purchase status transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS purchase_orders_status_transition_guard ON purchase_orders;
CREATE TRIGGER purchase_orders_status_transition_guard
BEFORE UPDATE OF status ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION guard_purchase_order_status_transition();
