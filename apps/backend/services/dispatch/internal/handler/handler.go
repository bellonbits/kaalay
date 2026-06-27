package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/dispatch/internal/repository"
	"github.com/suqafuran/express/services/dispatch/internal/service"
	"github.com/suqafuran/express/shared/pkg"
)

// Handler contains dispatch endpoint handlers.
type Handler struct {
	db      *pgxpool.Pool
	repo    repository.DispatchRepository
	service *service.DispatchService
}

// NewHandler creates a new handler.
func NewHandler(db *pgxpool.Pool, repo repository.DispatchRepository, svc *service.DispatchService) *Handler {
	return &Handler{
		db:      db,
		repo:    repo,
		service: svc,
	}
}

// HealthHandler returns service health.
func (h *Handler) HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, pkg.HealthResponse{
		Status:  "healthy",
		Message: "Dispatch service is running",
	})
}

// ReadyHandler checks if service is ready.
func (h *Handler) ReadyHandler(c *gin.Context) {
	if err := h.db.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, pkg.ReadyResponse{
			Ready: false,
			Details: map[string]string{
				"database": "unreachable",
			},
		})
		return
	}

	c.JSON(http.StatusOK, pkg.ReadyResponse{
		Ready: true,
		Details: map[string]string{
			"database": "ok",
		},
	})
}

// GetDispatchJobHandler retrieves a dispatch job.
func (h *Handler) GetDispatchJobHandler(c *gin.Context) {
	jobID := c.Param("id")

	// Parse UUID and retrieve job
	job, err := h.repo.GetDispatchJob(c.Request.Context(), parseUUID(jobID))
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("dispatch job not found"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(job))
}

// Helper to parse UUID
func parseUUID(id string) any {
	// In real implementation, use uuid.Parse
	return id
}
