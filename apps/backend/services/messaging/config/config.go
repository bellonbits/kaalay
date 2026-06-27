package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port       int
	DBConnStr  string
	RedisAddr  string
	JWTSecret  string
}

func Load() *Config {
	return &Config{
		Port:      getEnvInt("PORT", 8008),
		DBConnStr: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5437/suqafuran_messaging?sslmode=disable"),
		RedisAddr: getEnv("REDIS_ADDR", "localhost:6379"),
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
