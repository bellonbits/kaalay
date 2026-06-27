package pkg

// APIResponse is the standard response shape for all API endpoints.
// Matches current FastAPI response format for zero breaking changes.
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// SuccessResponse creates a success response.
func SuccessResponse(data interface{}) APIResponse {
	return APIResponse{
		Success: true,
		Data:    data,
	}
}

// ErrorResponse creates an error response.
func ErrorResponse(msg string) APIResponse {
	return APIResponse{
		Success: false,
		Error:   msg,
	}
}

// PaginatedResponse wraps paginated data.
type PaginatedResponse struct {
	Items      interface{} `json:"items"`
	Total      int64       `json:"total"`
	Limit      int         `json:"limit"`
	Offset     int         `json:"offset"`
	HasMore    bool        `json:"has_more"`
}

// HealthResponse for /health endpoint.
type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// ReadyResponse for /ready endpoint.
type ReadyResponse struct {
	Ready   bool              `json:"ready"`
	Details map[string]string `json:"details,omitempty"`
}
