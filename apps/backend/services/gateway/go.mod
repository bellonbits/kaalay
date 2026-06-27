module github.com/suqafuran/express/services/gateway

go 1.24

require (
	github.com/gin-gonic/gin v1.10.0
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/google/uuid v1.6.0
	github.com/redis/go-redis/v9 v9.7.0
	github.com/rs/zerolog v1.33.0
	github.com/suqafuran/express/shared v0.0.1
	github.com/swaggo/files v1.0.1
	github.com/swaggo/gin-swagger v1.6.0
)

replace github.com/suqafuran/express/shared => ../../shared
