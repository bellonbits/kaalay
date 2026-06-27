package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/dispatch/internal/model"
	"github.com/suqafuran/express/services/dispatch/internal/repository"
	"github.com/sony/gobreaker"
)

// DispatchService orchestrates driver assignment.
type DispatchService struct {
	repo             repository.DispatchRepository
	redis            *redis.Client
	nats             *nats.Conn
	circuitBreaker   *gobreaker.CircuitBreaker
	scoringWeights   model.ScoringWeights
	maxDistanceKm    float64
	jobTimeoutSecs   int
}

// NewDispatchService creates a new dispatch service.
func NewDispatchService(
	repo repository.DispatchRepository,
	redisClient *redis.Client,
	nc *nats.Conn,
) *DispatchService {
	settings := gobreaker.Settings{
		Name:        "DispatchService",
		MaxRequests: 3,
		Interval:    time.Second * 10,
		Timeout:     time.Second * 30,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 3 && failureRatio >= 0.6
		},
	}

	return &DispatchService{
		repo:           repo,
		redis:          redisClient,
		nats:           nc,
		circuitBreaker: gobreaker.NewCircuitBreaker(settings),
		scoringWeights: model.DefaultScoringWeights(),
		maxDistanceKm:  10.0, // Search within 10km
		jobTimeoutSecs: 30,   // 30-second timeout for driver response
	}
}

// OrderCreatedEvent mirrors the event from Order service.
type OrderCreatedEvent struct {
	Event        string     `json:"event"`
	OrderID      uuid.UUID  `json:"order_id"`
	CustomerID   uuid.UUID  `json:"customer_id"`
	PickupLat    *float64   `json:"pickup_lat"`
	PickupLng    *float64   `json:"pickup_lng"`
	DropoffLat   *float64   `json:"dropoff_lat"`
	DropoffLng   *float64   `json:"dropoff_lng"`
	TotalAmount  *float64   `json:"total_amount"`
	DeliveryFee  *float64   `json:"delivery_fee"`
	Timestamp    int64      `json:"ts"`
}

// OnOrderCreated handles new order events.
func (s *DispatchService) OnOrderCreated(ctx context.Context, event OrderCreatedEvent) error {
	log.Info().
		Str("order_id", event.OrderID.String()).
		Msg("Processing order.created event")

	if event.PickupLat == nil || event.PickupLng == nil ||
		event.DropoffLat == nil || event.DropoffLng == nil {
		return fmt.Errorf("invalid order location data")
	}

	// Create dispatch job
	job := model.NewDispatchJob(event.OrderID)
	if err := s.repo.CreateDispatchJob(ctx, job); err != nil {
		return fmt.Errorf("failed to create dispatch job: %w", err)
	}

	log.Info().
		Str("job_id", job.ID.String()).
		Str("order_id", event.OrderID.String()).
		Msg("Dispatch job created")

	// Find nearby drivers and make offers
	go func() {
		assignCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := s.assignDriver(assignCtx, job, *event.PickupLat, *event.PickupLng,
			*event.DropoffLat, *event.DropoffLng, *event.DeliveryFee); err != nil {
			log.Error().Err(err).
				Str("order_id", event.OrderID.String()).
				Msg("Failed to assign driver")
		}
	}()

	return nil
}

// assignDriver finds and offers drivers for a job.
func (s *DispatchService) assignDriver(ctx context.Context, job *model.DispatchJob,
	pickupLat, pickupLng, dropoffLat, dropoffLng, deliveryFee float64) error {

	// Find nearby available drivers using Redis GEOSEARCH
	candidates, err := s.getNearbyDrivers(ctx, pickupLat, pickupLng, job.BroadcastToDrivers*2)
	if err != nil {
		return fmt.Errorf("failed to find nearby drivers: %w", err)
	}

	if len(candidates) == 0 {
		log.Warn().
			Str("job_id", job.ID.String()).
			Msg("No nearby drivers found")
		return nil
	}

	// Score and sort drivers
	for _, candidate := range candidates {
		s.scoringWeights.ScoreDriver(candidate, s.maxDistanceKm)
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Score > candidates[j].Score
	})

	// Offer to top N drivers
	topDrivers := candidates
	if len(topDrivers) > job.BroadcastToDrivers {
		topDrivers = topDrivers[:job.BroadcastToDrivers]
	}

	distance := haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng)

	for _, candidate := range topDrivers {
		go func(driver *model.DriverCandidate) {
			offerCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			if err := s.sendJobOffer(offerCtx, job, driver, distance, deliveryFee); err != nil {
				log.Error().Err(err).
					Str("driver_id", driver.ID.String()).
					Str("job_id", job.ID.String()).
					Msg("Failed to send job offer")
			}
		}(candidate)
	}

	// Update job status to "offered"
	if err := s.repo.UpdateDispatchJobStatus(ctx, job.ID, "offered", nil); err != nil {
		log.Error().Err(err).Msg("Failed to update job status")
	}

	return nil
}

// getNearbyDrivers retrieves drivers within radius using Redis GEOSEARCH.
func (s *DispatchService) getNearbyDrivers(ctx context.Context, lat, lng float64, limit int) ([]*model.DriverCandidate, error) {
	// GEOSEARCH in Redis for drivers within radius
	// This would use Redis Geo commands: GEOSEARCH drivers:active FROMMEMBER|FROMLONLAT
	// For now, simulate with a mock implementation

	// In production, use:
	// cmd := redis.NewGeoSearchLocationQuery().
	//   ByRadius(10, "km").
	//   FromLonLat(lng, lat)
	// results, err := s.redis.GeoSearchLocation(ctx, "drivers:active", cmd).Result()

	// Simplified: get all online drivers and filter by distance
	candidates := []*model.DriverCandidate{
		// These would come from Redis GEOSEARCH or a driver service call
	}

	return candidates, nil
}

// sendJobOffer sends a job offer to a driver via WebSocket or gRPC.
func (s *DispatchService) sendJobOffer(ctx context.Context, job *model.DispatchJob,
	driver *model.DriverCandidate, distanceKm, deliveryFee float64) error {

	offer := model.JobOfferEvent{
		JobID:            job.ID,
		OrderID:          job.OrderID,
		PickupLat:        driver.CurrentLat, // These would come from order data
		PickupLng:        driver.CurrentLng,
		PickupAddress:    "Pickup address",  // Get from order service
		DropoffLat:       driver.CurrentLat,
		DropoffLng:       driver.CurrentLng,
		DropoffAddress:   "Dropoff address", // Get from order service
		DistanceKm:       distanceKm,
		EstimatedFareKsh: deliveryFee,
		ExpiresInSeconds: s.jobTimeoutSecs,
		Timestamp:        time.Now().Unix(),
	}

	data, err := json.Marshal(offer)
	if err != nil {
		return fmt.Errorf("failed to marshal job offer: %w", err)
	}

	// Use circuit breaker for resilience
	_, err = s.circuitBreaker.Execute(func() (interface{}, error) {
		// In production, send via WebSocket to driver
		// For now, publish via NATS
		subject := fmt.Sprintf("dispatch.job_offer.%s", driver.ID.String())
		return nil, s.nats.Publish(subject, data)
	})

	if err != nil {
		return fmt.Errorf("failed to send job offer: %w", err)
	}

	log.Info().
		Str("driver_id", driver.ID.String()).
		Str("job_id", job.ID.String()).
		Float64("score", driver.Score).
		Msg("Job offer sent")

	return nil
}

// OnDriverAccepted handles driver acceptance.
func (s *DispatchService) OnDriverAccepted(ctx context.Context, jobID, driverID uuid.UUID) error {
	log.Info().
		Str("driver_id", driverID.String()).
		Str("job_id", jobID.String()).
		Msg("Driver accepted job")

	// Update job status
	if err := s.repo.UpdateDispatchJobStatus(ctx, jobID, "accepted", &driverID); err != nil {
		return fmt.Errorf("failed to update job status: %w", err)
	}

	// Publish driver.assigned event
	s.publishDriverAssignedEvent(ctx, jobID, driverID)

	return nil
}

// OnDriverRejected handles driver rejection.
func (s *DispatchService) OnDriverRejected(ctx context.Context, jobID, driverID uuid.UUID, reason string) error {
	log.Info().
		Str("driver_id", driverID.String()).
		Str("job_id", jobID.String()).
		Str("reason", reason).
		Msg("Driver rejected job")

	// Record rejection
	rejection := &model.DriverRejection{
		DispatchJobID: jobID,
		DriverID:      driverID,
		Reason:        reason,
	}

	if err := s.repo.RecordRejection(ctx, rejection); err != nil {
		return fmt.Errorf("failed to record rejection: %w", err)
	}

	// Check if we should try again
	job, err := s.repo.GetDispatchJob(ctx, jobID)
	if err != nil {
		return fmt.Errorf("failed to get dispatch job: %w", err)
	}

	rejectionCount, err := s.repo.GetRejectionCount(ctx, jobID)
	if err != nil {
		return fmt.Errorf("failed to get rejection count: %w", err)
	}

	if rejectionCount < job.MaxAttempts {
		log.Info().
			Str("job_id", jobID.String()).
			Int("rejections", rejectionCount).
			Int("max_attempts", job.MaxAttempts).
			Msg("Attempting reassignment")

		// Trigger reassignment (simplified)
		// In production, would fetch order details and call assignDriver again
	} else {
		log.Error().
			Str("job_id", jobID.String()).
			Int("rejections", rejectionCount).
			Msg("Max assignment attempts reached")

		// Update job status to rejected
		s.repo.UpdateDispatchJobStatus(ctx, jobID, "rejected", nil)

		// Publish event for order service to handle (cancel, escalate, etc.)
	}

	return nil
}

// CheckJobTimeouts checks for expired job offers and retries.
func (s *DispatchService) CheckJobTimeouts(ctx context.Context) error {
	expiredJobs, err := s.repo.ListExpiredJobs(ctx)
	if err != nil {
		return fmt.Errorf("failed to list expired jobs: %w", err)
	}

	log.Info().Int("expired_jobs", len(expiredJobs)).Msg("Checking expired jobs")

	for _, job := range expiredJobs {
		// Record a timeout rejection
		// Get one of the offered drivers and record a timeout
		// Then attempt reassignment

		if job.Status == "offered" {
			log.Warn().
				Str("job_id", job.ID.String()).
				Msg("Job offer expired, retrying")

			// Trigger reassignment
			// job.Attempts++
			// s.repo.UpdateDispatchJobStatus(ctx, job.ID, "unassigned", nil)
		}
	}

	return nil
}

// publishDriverAssignedEvent publishes driver assignment event.
func (s *DispatchService) publishDriverAssignedEvent(ctx context.Context, jobID, driverID uuid.UUID) {
	if s.nats == nil || s.nats.Status() != nats.CONNECTED {
		log.Warn().Msg("NATS not connected")
		return
	}

	event := map[string]interface{}{
		"event":     "driver.assigned",
		"job_id":    jobID.String(),
		"driver_id": driverID.String(),
		"ts":        time.Now().Unix(),
	}

	data, _ := json.Marshal(event)
	s.nats.Publish("driver.assigned", data)
}

// Helper function for distance calculation
func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth radius in km
	dLat := (lat2 - lat1) * (3.14159 / 180)
	dLon := (lon2 - lon1) * (3.14159 / 180)
	a := (dLat/2)*(dLat/2) + (dLon/2)*(dLon/2)
	c := 2 * 3.14159 / 180 * a
	return R * c
}
