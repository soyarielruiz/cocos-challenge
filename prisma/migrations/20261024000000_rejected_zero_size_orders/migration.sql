ALTER TABLE orders
  DROP CONSTRAINT orders_size_positive_check,
  ADD CONSTRAINT orders_size_rejected_zero_check
    CHECK (size > 0 OR (size = 0 AND status = 'REJECTED'));
