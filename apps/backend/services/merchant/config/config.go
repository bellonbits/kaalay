package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port       int
	DBConnStr  string
	JWTSecret  string
}

func Load() *Config {
	return &Config{
		Port:      getEnvInt("PORT", 8003),
		DBConnStr: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5435/suqafuran_merchant?sslmode=disable"),
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
