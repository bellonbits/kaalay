package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port                  int
	DBConnStr             string
	RedisAddr             string
	NatsAddr              string
	JWTSecret             string
	MpesaConsumerKey      string
	MpesaConsumerSecret   string
	MpesaBizShortCode     string
	MpesaBizPasskey       string
	MpesaLipanaURL        string
	MpesaCallbackURL      string
	PlatformFeePercent    float64
	EscrowReleaseFeeKES   float64
}

func Load() *Config {
	return &Config{
		Port:                getEnvInt("PORT", 8010),
		DBConnStr:          getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5437/suqafuran_payment?sslmode=disable"),
		RedisAddr:          getEnv("REDIS_ADDR", "localhost:6379"),
		NatsAddr:           getEnv("NATS_ADDR", "localhost:4222"),
		JWTSecret:          getEnv("JWT_SECRET", "dev-secret-key-change-in-production"),
		MpesaConsumerKey:   getEnv("MPESA_CONSUMER_KEY", ""),
		MpesaConsumerSecret: getEnv("MPESA_CONSUMER_SECRET", ""),
		MpesaBizShortCode:  getEnv("MPESA_BIZ_SHORT_CODE", ""),
		MpesaBizPasskey:    getEnv("MPESA_BIZ_PASSKEY", ""),
		MpesaLipanaURL:     getEnv("MPESA_LIPANA_URL", "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"),
		MpesaCallbackURL:   getEnv("MPESA_CALLBACK_URL", "https://api.suqafuran.com/v1/payments/mpesa/callback"),
		PlatformFeePercent: getEnvFloat("PLATFORM_FEE_PERCENT", 0.20),
		EscrowReleaseFeeKES: getEnvFloat("ESCROW_RELEASE_FEE_KES", 0),
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

func getEnvFloat(key string, defaultVal float64) float64 {
	if value := os.Getenv(key); value != "" {
		if fVal, err := strconv.ParseFloat(value, 64); err == nil {
			return fVal
		}
	}
	return defaultVal
}
