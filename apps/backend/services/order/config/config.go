package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port       int
	DBConnStr  string
	NatsURL    string
	JWTSecret  string
}

func Load() *Config {
	return &Config{
		Port:      getEnvInt("PORT", 8004),
		DBConnStr: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5436/suqafuran_order?sslmode=disable"),
		NatsURL:   getEnv("NATS_URL", "nats://localhost:4222"),
		JWTSecret: getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
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
