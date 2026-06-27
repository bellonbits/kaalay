-- Tracking Service Schema

-- Driver Location History (for analytics/replay)
CREATE TABLE IF NOT EXISTS driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  accuracy INT,
  heading INT,
  speed DECIMAL(5,2),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_driver_location_history_driver_id ON driver_location_history(driver_id);
CREATE INDEX idx_driver_location_history_recorded_at ON driver_location_history(recorded_at DESC);
CREATE INDEX idx_driver_location_history_driver_recorded ON driver_location_history(driver_id, recorded_at DESC);

-- WebSocket Connection Sessions (for reconnection tracking)
CREATE TABLE IF NOT EXISTS ws_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  connection_id VARCHAR(255) NOT NULL UNIQUE,
  user_type VARCHAR(50) NOT NULL, -- driver, customer, merchant
  connected_at TIMESTAMPTZ DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_ws_sessions_user_id ON ws_sessions(user_id);
CREATE INDEX idx_ws_sessions_connection_id ON ws_sessions(connection_id);
CREATE INDEX idx_ws_sessions_is_active ON ws_sessions(is_active);

-- Tracking Subscriptions (which orders are being tracked by whom)
CREATE TABLE IF NOT EXISTS tracking_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_type VARCHAR(50) NOT NULL, -- customer, merchant, driver
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX idx_tracking_subscriptions_order_id ON tracking_subscriptions(order_id);
CREATE INDEX idx_tracking_subscriptions_user_id ON tracking_subscriptions(user_id);
CREATE INDEX idx_tracking_subscriptions_unsubscribed ON tracking_subscriptions(unsubscribed_at);
