-- Order Service Schema

-- Orders (marketplace + standalone delivery)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  merchant_id UUID,
  type VARCHAR(50) NOT NULL, -- marketplace, grocery, restaurant, parcel, same_day, scheduled
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, accepted, preparing, ready_for_pickup, driver_assigned, picked_up, in_transit, delivered, cancelled
  total_amount DECIMAL(12,2),
  delivery_fee DECIMAL(12,2),
  platform_fee DECIMAL(12,2),
  currency VARCHAR(10) DEFAULT 'KES',
  pickup_lat DECIMAL(10,7),
  pickup_lng DECIMAL(10,7),
  pickup_address TEXT,
  dropoff_lat DECIMAL(10,7),
  dropoff_lng DECIMAL(10,7),
  dropoff_address TEXT,
  scheduled_at TIMESTAMPTZ,
  special_instructions TEXT,
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
  payment_method VARCHAR(50), -- mpesa, evc, zaad, sahal, wallet, cash
  customer_phone VARCHAR(20),
  customer_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_type ON orders(type);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID,
  product_name VARCHAR(255) NOT NULL,
  product_name_so VARCHAR(255),
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Deliveries (assignment to driver)
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  driver_id UUID,
  pickup_at TIMESTAMPTZ,
  arrived_at_pickup TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  proof_image_url TEXT,
  signature_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX idx_deliveries_created_at ON deliveries(created_at);

-- Order Status History (audit trail)
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  reason TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);

-- Delivery Ratings
CREATE TABLE IF NOT EXISTS delivery_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  driver_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_delivery_ratings_order_id ON delivery_ratings(order_id);
CREATE INDEX idx_delivery_ratings_driver_id ON delivery_ratings(driver_id);
CREATE INDEX idx_delivery_ratings_customer_id ON delivery_ratings(customer_id);
