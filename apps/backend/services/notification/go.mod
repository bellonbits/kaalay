module github.com/suqafuran/express/services/notification

go 1.24

require (
	cloud.google.com/go/messaging v1.10.1
	firebase.google.com/go/v4 v4.14.1
	github.com/gin-gonic/gin v1.10.0
	github.com/jackc/pgx/v5 v5.7.0
	github.com/nats-io/nats.go v1.36.0
	github.com/redis/go-redis/v9 v9.7.0
	github.com/rs/zerolog v1.33.0
	github.com/sendgrid/sendgrid-go v3.14.0+incompatible
	github.com/suqafuran/express/shared v0.0.1
)

replace github.com/suqafuran/express/shared => ../../shared
