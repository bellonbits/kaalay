package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port      int
	DBConnStr string
	RedisAddr string
	JWTSecret string
}

func Load() *Config {
	port := 8002
	if p := os.Getenv("PORT"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil {
			port = parsed
		}
	}

	return &Config{
		Port:      port,
		DBConnStr: getEnv("DATABASE_URL", "postgresql://kaalay:kaalay_dev_pass@localhost:5432/kaalay_delivery"),
		RedisAddr: getEnv("REDIS_URL", "localhost:6379"),
		JWTSecret: getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
