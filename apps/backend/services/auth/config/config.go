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
	OTPLength  int
	OTPTTL     int // seconds
}

func Load() *Config {
	return &Config{
		Port:      getEnvInt("PORT", 8001),
		DBConnStr: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/suqafuran_auth?sslmode=disable"),
		RedisAddr: getEnv("REDIS_ADDR", "localhost:6379"),
		JWTSecret: getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
		OTPLength: getEnvInt("OTP_LENGTH", 6),
		OTPTTL:    getEnvInt("OTP_TTL", 300), // 5 minutes
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
