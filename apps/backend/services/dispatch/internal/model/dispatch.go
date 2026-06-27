package model

import (
	"time"

	"github.com/google/uuid"
)

// DispatchJob tracks driver assignment for an order.
type DispatchJob struct {
	ID                   uuid.UUID
	OrderID              uuid.UUID
	Status               string // unassigned, offered, accepted, rejected, expired, cancelled
	AssignedDriverID     *uuid.UUID
	Attempts             int
	MaxAttempts          int
	BroadcastToDrivers   int // number of drivers to offer simultaneously (default 3)
	CreatedAt            time.Time
	AssignedAt           *time.Time
	ExpiresAt            time.Time
}

// DriverRejection tracks why drivers reject jobs.
type DriverRejection struct {
	ID              uuid.UUID
	DispatchJobID   uuid.UUID
	DriverID        uuid.UUID
	Reason          string // too_far, low_rating, on_break, manually_declined, timeout
	CreatedAt       time.Time
}

// DispatchMetrics tracks dispatch performance.
type DispatchMetrics struct {
	ID                        uuid.UUID
	DateHour                  time.Time
	TotalJobsCreated          int
	TotalJobsAssigned         int
	AvgAssignmentTimeSeconds  int
	TotalRejections           int
	AvgDistanceKm             float64
	CreatedAt                 time.Time
}

// DriverCandidate represents a potential driver for assignment.
type DriverCandidate struct {
	ID              uuid.UUID
	Distance        float64   // km from order pickup
	Rating          float32   // 1-5 stars
	AcceptanceRate  float32   // 0-100%
	Status          string    // online, offline, busy
	CurrentLat      float64
	CurrentLng      float64
	VehicleType     string    // motorcycle, car, truck
	Score           float64   // calculated score (0-100)
	LastHeartbeat   time.Time
}

// JobOfferEvent is sent to drivers for acceptance.
type JobOfferEvent struct {
	JobID              uuid.UUID `json:"job_id"`
	OrderID            uuid.UUID `json:"order_id"`
	PickupLat          float64   `json:"pickup_lat"`
	PickupLng          float64   `json:"pickup_lng"`
	PickupAddress      string    `json:"pickup_address"`
	DropoffLat         float64   `json:"dropoff_lat"`
	DropoffLng         float64   `json:"dropoff_lng"`
	DropoffAddress     string    `json:"dropoff_address"`
	DistanceKm         float64   `json:"distance_km"`
	EstimatedFareKsh   float64   `json:"estimated_fare_ksh"`
	ExpiresInSeconds   int       `json:"expires_in_seconds"`
	Timestamp          int64     `json:"ts"`
}

// NewDispatchJob creates a new dispatch job.
func NewDispatchJob(orderID uuid.UUID) *DispatchJob {
	return &DispatchJob{
		ID:                 uuid.New(),
		OrderID:            orderID,
		Status:             "unassigned",
		Attempts:           0,
		MaxAttempts:        3,
		BroadcastToDrivers: 3,
		CreatedAt:          time.Now(),
		ExpiresAt:          time.Now().Add(30 * time.Second),
	}
}

// ScoringWeights for driver matching algorithm.
type ScoringWeights struct {
	DistanceWeight     float64 // 50% - closer is better
	RatingWeight       float64 // 30% - higher rating is better
	AcceptanceWeight   float64 // 20% - higher acceptance rate is better
}

// DefaultScoringWeights returns the default scoring weights.
func DefaultScoringWeights() ScoringWeights {
	return ScoringWeights{
		DistanceWeight:   0.50,
		RatingWeight:     0.30,
		AcceptanceWeight: 0.20,
	}
}

// ScoreDriver calculates a composite score for a driver.
// Distance score: max 10km gets 0 points, 0km gets 100 points
// Rating score: 5.0 stars gets 100 points, 1.0 star gets 0 points
// Acceptance score: 100% gets 100 points, 0% gets 0 points
func (weights ScoringWeights) ScoreDriver(candidate *DriverCandidate, maxDistanceKm float64) float64 {
	// Distance score (inverted: closer = higher score)
	distanceScore := 0.0
	if candidate.Distance > maxDistanceKm {
		distanceScore = 0.0 // Too far, no points
	} else if candidate.Distance == 0 {
		distanceScore = 100.0
	} else {
		distanceScore = (1.0 - (candidate.Distance / maxDistanceKm)) * 100.0
	}

	// Rating score (1-5 stars)
	ratingScore := ((float64(candidate.Rating) - 1.0) / 4.0) * 100.0
	if ratingScore < 0 {
		ratingScore = 0
	}
	if ratingScore > 100 {
		ratingScore = 100
	}

	// Acceptance rate score (0-100%)
	acceptanceScore := float64(candidate.AcceptanceRate)

	// Composite score
	score := (distanceScore * weights.DistanceWeight) +
		(ratingScore * weights.RatingWeight) +
		(acceptanceScore * weights.AcceptanceWeight)

	candidate.Score = score
	return score
}

// GetStatusColor returns a color code for dispatch status.
func (j *DispatchJob) GetStatusColor() string {
	switch j.Status {
	case "unassigned":
		return "yellow"
	case "offered":
		return "orange"
	case "accepted":
		return "green"
	case "rejected":
		return "red"
	case "expired":
		return "gray"
	case "cancelled":
		return "gray"
	default:
		return "white"
	}
}
