-- Merchant Service Schema

-- Merchants (stores on Suqafuran Express)
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description_en TEXT,
  description_so TEXT,
  logo_url TEXT,
  banner_url TEXT,
  location_lat DECIMAL(10,7),
  location_lng DECIMAL(10,7),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_orders INT DEFAULT 0,
  suqafuran_business_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_merchants_user_id ON merchants(user_id);
CREATE INDEX idx_merchants_slug ON merchants(slug);
CREATE INDEX idx_merchants_is_active ON merchants(is_active);
CREATE INDEX idx_merchants_is_verified ON merchants(is_verified);
CREATE INDEX idx_merchants_location ON merchants(location_lat, location_lng);

-- Store Hours
CREATE TABLE IF NOT EXISTS store_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_store_hours_merchant_id ON store_hours(merchant_id);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name_en VARCHAR(255) NOT NULL,
  name_so VARCHAR(255),
  description_en TEXT,
  description_so TEXT,
  sku VARCHAR(100),
  price DECIMAL(12,2) NOT NULL,
  discount_price DECIMAL(12,2),
  stock_level INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  category VARCHAR(100),
  images JSONB DEFAULT '[]',
  variants JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  suqafuran_product_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_stock ON products(stock_level);

-- Merchant Employees
CREATE TABLE IF NOT EXISTS merchant_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_merchant_employees_merchant_id ON merchant_employees(merchant_id);
CREATE INDEX idx_merchant_employees_user_id ON merchant_employees(user_id);
CREATE UNIQUE INDEX idx_merchant_employees_unique ON merchant_employees(merchant_id, user_id);

-- Merchant Customers (CRM)
CREATE TABLE IF NOT EXISTS merchant_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  loyalty_score INT DEFAULT 0,
  segmentation VARCHAR(50) DEFAULT 'new',
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_merchant_customers_merchant_id ON merchant_customers(merchant_id);
CREATE INDEX idx_merchant_customers_customer_id ON merchant_customers(customer_id);
CREATE UNIQUE INDEX idx_merchant_customers_unique ON merchant_customers(merchant_id, customer_id);
