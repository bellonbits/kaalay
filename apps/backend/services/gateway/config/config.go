package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port                 int
	JWTSecret            string
	RedisAddr            string
	LegacyFastAPIURL     string
	AuthServiceURL       string
	UserServiceURL       string
	MerchantServiceURL   string
	OrderServiceURL      string
	DispatchServiceURL   string
	DriverServiceURL     string
	TrackingServiceURL   string
	MessagingServiceURL  string
	NotificationServiceURL string
	PaymentServiceURL    string
}

func Load() *Config {
	return &Config{
		Port:                 getEnvInt("PORT", 8000),
		JWTSecret:            getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
		RedisAddr:            getEnv("REDIS_ADDR", "localhost:6379"),
		LegacyFastAPIURL:     getEnv("LEGACY_FASTAPI_URL", "http://localhost:3000"),
		AuthServiceURL:       getEnv("AUTH_SERVICE_URL", "http://localhost:8001"),
		UserServiceURL:       getEnv("USER_SERVICE_URL", "http://localhost:8002"),
		MerchantServiceURL:   getEnv("MERCHANT_SERVICE_URL", "http://localhost:8003"),
		OrderServiceURL:      getEnv("ORDER_SERVICE_URL", "http://localhost:8004"),
		DispatchServiceURL:   getEnv("DISPATCH_SERVICE_URL", "http://localhost:8005"),
		DriverServiceURL:     getEnv("DRIVER_SERVICE_URL", "http://localhost:8006"),
		TrackingServiceURL:   getEnv("TRACKING_SERVICE_URL", "http://localhost:8007"),
		MessagingServiceURL:  getEnv("MESSAGING_SERVICE_URL", "http://localhost:8008"),
		NotificationServiceURL: getEnv("NOTIFICATION_SERVICE_URL", "http://localhost:8009"),
		PaymentServiceURL:    getEnv("PAYMENT_SERVICE_URL", "http://localhost:8010"),
	}
}

func getEnv(key, defaultVal string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultVal
}
