DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'accountnumber'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'account_number'
  ) THEN
    ALTER TABLE users RENAME COLUMN accountnumber TO account_number;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'instrumentid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'instrument_id'
  ) THEN
    ALTER TABLE orders RENAME COLUMN instrumentid TO instrument_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'userid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE orders RENAME COLUMN userid TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'datetime'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE orders RENAME COLUMN datetime TO created_at;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'marketdata' AND column_name = 'instrumentid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'marketdata' AND column_name = 'instrument_id'
  ) THEN
    ALTER TABLE marketdata RENAME COLUMN instrumentid TO instrument_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'marketdata' AND column_name = 'previousclose'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'marketdata' AND column_name = 'previous_close'
  ) THEN
    ALTER TABLE marketdata RENAME COLUMN previousclose TO previous_close;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'marketdata' AND column_name = 'date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'marketdata' AND column_name = 'market_date'
  ) THEN
    ALTER TABLE marketdata RENAME COLUMN date TO market_date;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  account_number VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS instruments (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(10),
  name VARCHAR(255),
  type VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  instrument_id INTEGER,
  user_id INTEGER,
  size INTEGER,
  price NUMERIC(18, 2),
  type VARCHAR(10),
  side VARCHAR(10),
  status VARCHAR(20),
  created_at TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS marketdata (
  id SERIAL PRIMARY KEY,
  instrument_id INTEGER,
  high NUMERIC(18, 2),
  low NUMERIC(18, 2),
  open NUMERIC(18, 2),
  close NUMERIC(18, 2),
  previous_close NUMERIC(18, 2),
  market_date DATE
);

ALTER TABLE users
  ALTER COLUMN email TYPE VARCHAR(255),
  ALTER COLUMN account_number TYPE VARCHAR(20),
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN account_number SET NOT NULL;

ALTER TABLE instruments
  ALTER COLUMN ticker TYPE VARCHAR(10),
  ALTER COLUMN name TYPE VARCHAR(255),
  ALTER COLUMN type TYPE VARCHAR(10),
  ALTER COLUMN ticker SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN type SET NOT NULL;

ALTER TABLE orders
  ALTER COLUMN instrument_id TYPE INTEGER,
  ALTER COLUMN user_id TYPE INTEGER,
  ALTER COLUMN size TYPE INTEGER,
  ALTER COLUMN price TYPE NUMERIC(18, 2) USING price::NUMERIC(18, 2),
  ALTER COLUMN type TYPE VARCHAR(10),
  ALTER COLUMN side TYPE VARCHAR(10),
  ALTER COLUMN status TYPE VARCHAR(20),
  ALTER COLUMN created_at TYPE TIMESTAMP(6) USING created_at::TIMESTAMP(6),
  ALTER COLUMN instrument_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN size SET NOT NULL,
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN side SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE marketdata
  ALTER COLUMN instrument_id TYPE INTEGER,
  ALTER COLUMN high TYPE NUMERIC(18, 2) USING high::NUMERIC(18, 2),
  ALTER COLUMN low TYPE NUMERIC(18, 2) USING low::NUMERIC(18, 2),
  ALTER COLUMN open TYPE NUMERIC(18, 2) USING open::NUMERIC(18, 2),
  ALTER COLUMN close TYPE NUMERIC(18, 2) USING close::NUMERIC(18, 2),
  ALTER COLUMN previous_close TYPE NUMERIC(18, 2) USING previous_close::NUMERIC(18, 2),
  ALTER COLUMN market_date TYPE DATE USING market_date::DATE,
  ALTER COLUMN instrument_id SET NOT NULL,
  ALTER COLUMN close SET NOT NULL,
  ALTER COLUMN previous_close SET NOT NULL,
  ALTER COLUMN market_date SET NOT NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint WHERE conrelid = 'orders'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT conname FROM pg_constraint WHERE conrelid = 'marketdata'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE marketdata DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE orders
  ADD CONSTRAINT orders_instrument_id_fkey
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE RESTRICT,
  ADD CONSTRAINT orders_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT orders_size_positive_check CHECK (size > 0),
  ADD CONSTRAINT orders_price_positive_check CHECK (price > 0),
  ADD CONSTRAINT orders_side_check CHECK (side IN ('BUY', 'SELL', 'CASH_IN', 'CASH_OUT')),
  ADD CONSTRAINT orders_type_check CHECK (type IN ('MARKET', 'LIMIT')),
  ADD CONSTRAINT orders_status_check CHECK (status IN ('NEW', 'FILLED', 'REJECTED', 'CANCELLED'));

ALTER TABLE marketdata
  ADD CONSTRAINT marketdata_instrument_id_fkey
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE RESTRICT;

ALTER TABLE users
  ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE instruments
  ADD CONSTRAINT instruments_ticker_key UNIQUE (ticker);

ALTER TABLE marketdata
  ADD CONSTRAINT marketdata_instrument_id_market_date_key UNIQUE (instrument_id, market_date);

CREATE INDEX orders_user_instrument_filled_idx
  ON orders (user_id, instrument_id)
  WHERE status = 'FILLED';

CREATE INDEX marketdata_instrument_market_date_desc_idx
  ON marketdata (instrument_id, market_date DESC);
