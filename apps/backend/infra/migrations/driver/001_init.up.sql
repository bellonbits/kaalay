-- Driver Service Schema

-- Driver Profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  vehicle_type VARCHAR(50) NOT NULL, -- motorcycle, car, bicycle, truck
  vehicle_model VARCHAR(100),
  vehicle_color VARCHAR(50),
  license_plate VARCHAR(20),
  license_url TEXT,
  id_doc_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  verification_date TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'offline', -- online, offline, busy, on_break
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_deliveries INT DEFAULT 0,
  acceptance_rate DECIMAL(5,2) DEFAULT 100.0,
  current_lat DECIMAL(10,7),
  current_lng DECIMAL(10,7),
  last_seen TIMESTAMPTZ,
  phone_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_status ON driver_profiles(status);
CREATE INDEX idx_driver_profiles_is_verified ON driver_profiles(is_verified);
CREATE INDEX idx_driver_profiles_location ON driver_profiles(current_lat, current_lng);

-- Driver Earnings
CREATE TABLE IF NOT EXISTS driver_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id),
  order_id UUID,
  gross_amount DECIMAL(12,2) NOT NULL,
  platform_fee DECIMAL(12,2),
  net_amount DECIMAL(12,2) NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_driver_earnings_driver_id ON driver_earnings(driver_id);
CREATE INDEX idx_driver_earnings_order_id ON driver_earnings(order_id);
CREATE INDEX idx_driver_earnings_created_at ON driver_earnings(created_at);

-- Driver Withdrawals
CREATE TABLE IF NOT EXISTS driver_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id),
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(50) NOT NULL, -- mpesa, evc, zaad, sahal
  phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  transaction_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_driver_withdrawals_driver_id ON driver_withdrawals(driver_id);
CREATE INDEX idx_driver_withdrawals_status ON driver_withdrawals(status);
CREATE INDEX idx_driver_withdrawals_created_at ON driver_withdrawals(created_at);

-- Driver Location History (analytics)
CREATE TABLE IF NOT EXISTS driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id),
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  accuracy INT, -- meters
  heading INT, -- 0-360 degrees
  recorded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_driver_location_history_driver_id ON driver_location_history(driver_id);
CREATE INDEX idx_driver_location_history_recorded_at ON driver_location_history(recorded_at);

-- Driver Documents
CREATE TABLE IF NOT EXISTS driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id),
  type VARCHAR(50) NOT NULL, -- license, national_id, insurance, inspection
  url TEXT NOT NULL,
  expiry_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, verified, rejected, expired
  rejected_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_driver_documents_driver_id ON driver_documents(driver_id);
CREATE INDEX idx_driver_documents_status ON driver_documents(status);
