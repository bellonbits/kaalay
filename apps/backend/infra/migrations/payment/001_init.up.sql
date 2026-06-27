-- Payment Service Schema

-- Payments (order-level payment)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  customer_id UUID NOT NULL,
  driver_id UUID,
  merchant_id UUID,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  payment_method VARCHAR(50) NOT NULL, -- mpesa, evc, zaad, sahal
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded
  mpesa_phone VARCHAR(20),
  mpesa_checkout_request_id VARCHAR(255),
  mpesa_merchant_request_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_driver_id ON payments(driver_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- Transactions (payment splits and history)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  recipient_type VARCHAR(50) NOT NULL, -- driver, merchant, platform
  type VARCHAR(50) NOT NULL, -- charge, refund, reversal
  amount DECIMAL(12,2) NOT NULL,
  fee DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,
  mpesa_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transactions_payment_id ON transactions(payment_id);
CREATE INDEX idx_transactions_recipient_id ON transactions(recipient_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Escrow (hold payments until delivery confirmed)
CREATE TABLE IF NOT EXISTS escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  held_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ,
  released_to UUID, -- driver_id
  status VARCHAR(50) DEFAULT 'held', -- held, released, refunded
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_escrow_payment_id ON escrow(payment_id);
CREATE INDEX idx_escrow_status ON escrow(status);
CREATE INDEX idx_escrow_released_to ON escrow(released_to);

-- M-Pesa Callbacks (webhook from Safaricom)
CREATE TABLE IF NOT EXISTS mpesa_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  transaction_id VARCHAR(255) UNIQUE,
  checkout_request_id VARCHAR(255),
  merchant_request_id VARCHAR(255),
  result_code VARCHAR(10),
  result_desc TEXT,
  amount DECIMAL(12,2),
  mpesa_receipt_number VARCHAR(255),
  phone_number VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mpesa_callbacks_payment_id ON mpesa_callbacks(payment_id);
CREATE INDEX idx_mpesa_callbacks_transaction_id ON mpesa_callbacks(transaction_id);
CREATE INDEX idx_mpesa_callbacks_status ON mpesa_callbacks(status);
CREATE INDEX idx_mpesa_callbacks_created_at ON mpesa_callbacks(created_at DESC);

-- Driver Wallets (earnings ledger)
CREATE TABLE IF NOT EXISTS driver_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE,
  available_balance DECIMAL(12,2) DEFAULT 0,
  pending_balance DECIMAL(12,2) DEFAULT 0,
  lifetime_earnings DECIMAL(12,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'KES',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_driver_wallets_driver_id ON driver_wallets(driver_id);

-- Driver Withdrawals
CREATE TABLE IF NOT EXISTS driver_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_wallets(driver_id),
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(50) NOT NULL, -- mpesa, evc, zaad, sahal
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  mpesa_reference VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_driver_withdrawals_driver_id ON driver_withdrawals(driver_id);
CREATE INDEX idx_driver_withdrawals_status ON driver_withdrawals(status);
CREATE INDEX idx_driver_withdrawals_created_at ON driver_withdrawals(created_at DESC);
