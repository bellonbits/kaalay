package handler

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/suqafuran/express/services/gateway/config"
	"github.com/suqafuran/express/shared/pkg"
)

// RouteRule defines a route with a target service and go-live status.
type RouteRule struct {
	Prefix       string
	ServiceURL   string
	Proxy        *httputil.ReverseProxy
	GoLive       bool // true = Go service live; false = proxy to FastAPI
}

// GatewayRouter implements Strangler Fig pattern.
type GatewayRouter struct {
	routes      []RouteRule
	legacyProxy *httputil.ReverseProxy
}

// NewGatewayRouter creates a new gateway router.
func NewGatewayRouter(cfg *config.Config) *GatewayRouter {
	legacyURL, _ := url.Parse(cfg.LegacyFastAPIURL)

	g := &GatewayRouter{
		legacyProxy: httputil.NewSingleHostReverseProxy(legacyURL),
	}

	// Route table — flip goLive=true as each Go service goes live
	g.routes = []RouteRule{
		{Prefix: "/api/v1/auth", ServiceURL: cfg.AuthServiceURL, Proxy: newProxy(cfg.AuthServiceURL), GoLive: true},
		{Prefix: "/api/v1/users", ServiceURL: cfg.UserServiceURL, Proxy: newProxy(cfg.UserServiceURL), GoLive: false},
		{Prefix: "/api/v1/merchants", ServiceURL: cfg.MerchantServiceURL, Proxy: newProxy(cfg.MerchantServiceURL), GoLive: false},
		{Prefix: "/api/v1/orders", ServiceURL: cfg.OrderServiceURL, Proxy: newProxy(cfg.OrderServiceURL), GoLive: true},
		{Prefix: "/api/v1/dispatch", ServiceURL: cfg.DispatchServiceURL, Proxy: newProxy(cfg.DispatchServiceURL), GoLive: false},
		{Prefix: "/api/v1/drivers", ServiceURL: cfg.DriverServiceURL, Proxy: newProxy(cfg.DriverServiceURL), GoLive: false},
		{Prefix: "/api/v1/tracking", ServiceURL: cfg.TrackingServiceURL, Proxy: newProxy(cfg.TrackingServiceURL), GoLive: false},
		{Prefix: "/api/v1/messages", ServiceURL: cfg.MessagingServiceURL, Proxy: newProxy(cfg.MessagingServiceURL), GoLive: false},
		{Prefix: "/api/v1/notifications", ServiceURL: cfg.NotificationServiceURL, Proxy: newProxy(cfg.NotificationServiceURL), GoLive: false},
		{Prefix: "/api/v1/payments", ServiceURL: cfg.PaymentServiceURL, Proxy: newProxy(cfg.PaymentServiceURL), GoLive: true},
		// Legacy routes: places, emergency, admin, etc. stay on FastAPI until Phase 5
		{Prefix: "/api/v1/places", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/emergency", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/admin", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/weather", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/ai", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/uploads", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/kh", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/location", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/guides", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/road-reports", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/rides", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
		{Prefix: "/api/v1/ws", ServiceURL: cfg.LegacyFastAPIURL, Proxy: g.legacyProxy, GoLive: false},
	}

	return g
}

// ProxyHandler routes requests based on Strangler Fig route table.
func (g *GatewayRouter) ProxyHandler(c *gin.Context) {
	path := c.Request.URL.Path

	for _, rule := range g.routes {
		if strings.HasPrefix(path, rule.Prefix) {
			if rule.GoLive {
				// Strip /api prefix before forwarding to Go service
				c.Request.URL.Path = strings.TrimPrefix(path, "/api")
				rule.Proxy.ServeHTTP(c.Writer, c.Request)
				return
			}
			// Not live yet — fall through to legacy
			break
		}
	}

	// Default: legacy FastAPI handles it (preserves full path /api/v1/...)
	g.legacyProxy.ServeHTTP(c.Writer, c.Request)
}

// HealthHandler returns service health.
func (g *GatewayRouter) HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, pkg.HealthResponse{
		Status:  "healthy",
		Message: "Suqafuran Express Gateway v1 is running",
	})
}

// ReadyHandler checks if gateway is ready (no DB dependencies).
func (g *GatewayRouter) ReadyHandler(c *gin.Context) {
	c.JSON(http.StatusOK, pkg.ReadyResponse{
		Ready: true,
		Details: map[string]string{
			"service": "gateway",
			"version": "1.0.0",
		},
	})
}

func newProxy(rawURL string) *httputil.ReverseProxy {
	u, _ := url.Parse(rawURL)
	rp := httputil.NewSingleHostReverseProxy(u)
	rp.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(`{"success":false,"error":"upstream service unavailable"}`))
	}
	return rp
}
