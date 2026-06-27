-- Dispatch Service Schema

-- Dispatch Jobs (assignment records)
CREATE TABLE IF NOT EXISTS dispatch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'unassigned', -- unassigned, offered, accepted, rejected, expired, cancelled
  assigned_driver_id UUID,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  broadcast_to_drivers INT DEFAULT 3, -- number of drivers to offer simultaneously
  created_at TIMESTAMPTZ DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_dispatch_jobs_order_id ON dispatch_jobs(order_id);
CREATE INDEX idx_dispatch_jobs_status ON dispatch_jobs(status);
CREATE INDEX idx_dispatch_jobs_assigned_driver_id ON dispatch_jobs(assigned_driver_id);
CREATE INDEX idx_dispatch_jobs_created_at ON dispatch_jobs(created_at);

-- Driver Rejections (track why drivers reject)
CREATE TABLE IF NOT EXISTS driver_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_job_id UUID NOT NULL REFERENCES dispatch_jobs(id),
  driver_id UUID NOT NULL,
  reason VARCHAR(255), -- too_far, low_rating, on_break, manually_declined, timeout
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_driver_rejections_dispatch_job_id ON driver_rejections(dispatch_job_id);
CREATE INDEX idx_driver_rejections_driver_id ON driver_rejections(driver_id);
CREATE INDEX idx_driver_rejections_created_at ON driver_rejections(created_at);

-- Dispatch Metrics (for analytics)
CREATE TABLE IF NOT EXISTS dispatch_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_hour TIMESTAMPTZ NOT NULL,
  total_jobs_created INT DEFAULT 0,
  total_jobs_assigned INT DEFAULT 0,
  avg_assignment_time INT, -- seconds
  total_rejections INT DEFAULT 0,
  avg_distance_km DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dispatch_metrics_date_hour ON dispatch_metrics(date_hour);
