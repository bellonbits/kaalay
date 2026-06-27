module github.com/suqafuran/express/services/dispatch

go 1.24

require (
	github.com/gin-gonic/gin v1.10.0
	github.com/jackc/pgx/v5 v5.7.0
	github.com/nats-io/nats.go v1.37.0
	github.com/redis/go-redis/v9 v9.7.0
	github.com/rs/zerolog v1.33.0
	github.com/suqafuran/express/shared v0.0.1
	github.com/sony/gobreaker v1.0.0
)

replace github.com/suqafuran/express/shared => ../../shared
