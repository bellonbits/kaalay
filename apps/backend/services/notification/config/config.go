package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port              int
	DBConnStr         string
	RedisAddr         string
	NatsAddr          string
	JWTSecret         string
	FCMServerKey      string
	AFApiKey          string
	AFSenderID        string
	SendGridAPIKey    string
	SendGridFromEmail string
}

func Load() *Config {
	return &Config{
		Port:              getEnvInt("PORT", 8009),
		DBConnStr:         getEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/kaalay_delivery"),
		RedisAddr:         getEnv("REDIS_URL", "localhost:6379"),
		NatsAddr:          getEnv("NATS_URL", "nats://localhost:4222"),
		JWTSecret:         getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
		FCMServerKey:      getEnv("FCM_SERVER_KEY", ""),
		AFApiKey:          getEnv("AF_API_KEY", ""),
		AFSenderID:        getEnv("AF_SENDER_ID", "suqafuran"),
		SendGridAPIKey:    getEnv("SENDGRID_API_KEY", ""),
		SendGridFromEmail: getEnv("SENDGRID_FROM_EMAIL", "noreply@suqafuran.com"),
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
