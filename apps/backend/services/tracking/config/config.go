package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port       int
	DBConnStr  string
	RedisAddr  string
	NatsAddr   string
	JWTSecret  string
}

func Load() *Config {
	return &Config{
		Port:      getEnvInt("PORT", 8007),
		DBConnStr: getEnv("DATABASE_URL", "postgresql://kaalay:kaalay_dev_pass@10.90.0.10:5432/kaalay_delivery"),
		RedisAddr: getEnv("REDIS_URL", "localhost:6379"),
		NatsAddr:  getEnv("NATS_URL", "nats://localhost:4222"),
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
