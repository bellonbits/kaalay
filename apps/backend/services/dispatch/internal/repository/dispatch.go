package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/dispatch/internal/model"
)

// DispatchRepository defines dispatch database operations.
type DispatchRepository interface {
	CreateDispatchJob(ctx context.Context, job *model.DispatchJob) error
	GetDispatchJob(ctx context.Context, id uuid.UUID) (*model.DispatchJob, error)
	GetDispatchJobByOrderID(ctx context.Context, orderID uuid.UUID) (*model.DispatchJob, error)
	UpdateDispatchJobStatus(ctx context.Context, jobID uuid.UUID, newStatus string, driverID *uuid.UUID) error
	ListExpiredJobs(ctx context.Context) ([]*model.DispatchJob, error)

	RecordRejection(ctx context.Context, rejection *model.DriverRejection) error
	GetRejectionCount(ctx context.Context, jobID uuid.UUID) (int, error)
	HasDriverRejectedJob(ctx context.Context, jobID, driverID uuid.UUID) (bool, error)

	RecordMetrics(ctx context.Context, metrics *model.DispatchMetrics) error
}

// PostgresDispatchRepository implements DispatchRepository.
type PostgresDispatchRepository struct {
	db *pgxpool.Pool
}

// NewPostgresDispatchRepository creates a new postgres dispatch repository.
func NewPostgresDispatchRepository(db *pgxpool.Pool) *PostgresDispatchRepository {
	return &PostgresDispatchRepository{db: db}
}

// CreateDispatchJob creates a new dispatch job.
func (r *PostgresDispatchRepository) CreateDispatchJob(ctx context.Context, job *model.DispatchJob) error {
	query := `
		INSERT INTO dispatch_jobs (id, order_id, status, assigned_driver_id, attempts, max_attempts, broadcast_to_drivers, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at
	`

	err := r.db.QueryRow(ctx, query,
		job.ID, job.OrderID, job.Status, job.AssignedDriverID, job.Attempts, job.MaxAttempts,
		job.BroadcastToDrivers, job.CreatedAt, job.ExpiresAt,
	).Scan(&job.ID, &job.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create dispatch job: %w", err)
	}

	return nil
}

// GetDispatchJob retrieves a dispatch job by ID.
func (r *PostgresDispatchRepository) GetDispatchJob(ctx context.Context, id uuid.UUID) (*model.DispatchJob, error) {
	query := `
		SELECT id, order_id, status, assigned_driver_id, attempts, max_attempts, broadcast_to_drivers, created_at, assigned_at, expires_at
		FROM dispatch_jobs
		WHERE id = $1
	`

	job := &model.DispatchJob{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&job.ID, &job.OrderID, &job.Status, &job.AssignedDriverID, &job.Attempts, &job.MaxAttempts,
		&job.BroadcastToDrivers, &job.CreatedAt, &job.AssignedAt, &job.ExpiresAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("dispatch job not found")
		}
		return nil, fmt.Errorf("failed to get dispatch job: %w", err)
	}

	return job, nil
}

// GetDispatchJobByOrderID retrieves a dispatch job by order ID.
func (r *PostgresDispatchRepository) GetDispatchJobByOrderID(ctx context.Context, orderID uuid.UUID) (*model.DispatchJob, error) {
	query := `
		SELECT id, order_id, status, assigned_driver_id, attempts, max_attempts, broadcast_to_drivers, created_at, assigned_at, expires_at
		FROM dispatch_jobs
		WHERE order_id = $1
	`

	job := &model.DispatchJob{}
	err := r.db.QueryRow(ctx, query, orderID).Scan(
		&job.ID, &job.OrderID, &job.Status, &job.AssignedDriverID, &job.Attempts, &job.MaxAttempts,
		&job.BroadcastToDrivers, &job.CreatedAt, &job.AssignedAt, &job.ExpiresAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("dispatch job not found")
		}
		return nil, fmt.Errorf("failed to get dispatch job: %w", err)
	}

	return job, nil
}

// UpdateDispatchJobStatus updates a dispatch job status and optionally assigns a driver.
func (r *PostgresDispatchRepository) UpdateDispatchJobStatus(ctx context.Context, jobID uuid.UUID, newStatus string, driverID *uuid.UUID) error {
	query := `
		UPDATE dispatch_jobs
		SET status = $1, assigned_driver_id = $2, assigned_at = $3, updated_at = NOW()
		WHERE id = $4
	`

	assignedAt := (*time.Time)(nil)
	if newStatus == "accepted" && driverID != nil {
		now := time.Now()
		assignedAt = &now
	}

	_, err := r.db.Exec(ctx, query, newStatus, driverID, assignedAt, jobID)

	if err != nil {
		return fmt.Errorf("failed to update dispatch job: %w", err)
	}

	return nil
}

// ListExpiredJobs retrieves jobs that have expired.
func (r *PostgresDispatchRepository) ListExpiredJobs(ctx context.Context) ([]*model.DispatchJob, error) {
	query := `
		SELECT id, order_id, status, assigned_driver_id, attempts, max_attempts, broadcast_to_drivers, created_at, assigned_at, expires_at
		FROM dispatch_jobs
		WHERE status IN ('unassigned', 'offered') AND expires_at < NOW()
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list expired jobs: %w", err)
	}
	defer rows.Close()

	jobs := []*model.DispatchJob{}
	for rows.Next() {
		job := &model.DispatchJob{}
		err := rows.Scan(
			&job.ID, &job.OrderID, &job.Status, &job.AssignedDriverID, &job.Attempts, &job.MaxAttempts,
			&job.BroadcastToDrivers, &job.CreatedAt, &job.AssignedAt, &job.ExpiresAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan dispatch job: %w", err)
		}
		jobs = append(jobs, job)
	}

	return jobs, nil
}

// RecordRejection records a driver rejection.
func (r *PostgresDispatchRepository) RecordRejection(ctx context.Context, rejection *model.DriverRejection) error {
	query := `
		INSERT INTO driver_rejections (id, dispatch_job_id, driver_id, reason, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	rejection.ID = uuid.New()
	rejection.CreatedAt = time.Now()

	_, err := r.db.Exec(ctx, query, rejection.ID, rejection.DispatchJobID, rejection.DriverID, rejection.Reason, rejection.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to record rejection: %w", err)
	}

	return nil
}

// GetRejectionCount returns number of rejections for a job.
func (r *PostgresDispatchRepository) GetRejectionCount(ctx context.Context, jobID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM driver_rejections WHERE dispatch_job_id = $1`

	var count int
	err := r.db.QueryRow(ctx, query, jobID).Scan(&count)

	if err != nil {
		return 0, fmt.Errorf("failed to count rejections: %w", err)
	}

	return count, nil
}

// HasDriverRejectedJob checks if a driver has already rejected a job.
func (r *PostgresDispatchRepository) HasDriverRejectedJob(ctx context.Context, jobID, driverID uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM driver_rejections WHERE dispatch_job_id = $1 AND driver_id = $2)`

	var exists bool
	err := r.db.QueryRow(ctx, query, jobID, driverID).Scan(&exists)

	if err != nil {
		return false, fmt.Errorf("failed to check rejection: %w", err)
	}

	return exists, nil
}

// RecordMetrics records dispatch performance metrics.
func (r *PostgresDispatchRepository) RecordMetrics(ctx context.Context, metrics *model.DispatchMetrics) error {
	query := `
		INSERT INTO dispatch_metrics (id, date_hour, total_jobs_created, total_jobs_assigned, avg_assignment_time, total_rejections, avg_distance_km, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	metrics.ID = uuid.New()
	metrics.CreatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		metrics.ID, metrics.DateHour, metrics.TotalJobsCreated, metrics.TotalJobsAssigned,
		metrics.AvgAssignmentTimeSeconds, metrics.TotalRejections, metrics.AvgDistanceKm, metrics.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to record metrics: %w", err)
	}

	return nil
}
