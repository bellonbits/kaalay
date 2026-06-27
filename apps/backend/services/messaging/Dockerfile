FROM golang:1.24-alpine AS builder
WORKDIR /build

COPY go.work .
COPY shared ./shared
COPY services/auth ./services/auth
COPY services/user ./services/user
COPY services/merchant ./services/merchant
COPY services/order ./services/order
COPY services/dispatch ./services/dispatch
COPY services/driver ./services/driver
COPY services/tracking ./services/tracking
COPY services/messaging ./services/messaging
COPY services/notification ./services/notification
COPY services/payment ./services/payment
COPY services/gateway ./services/gateway

RUN cd services/messaging && go build -o messaging ./cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates curl
WORKDIR /app
COPY --from=builder /build/services/messaging/messaging .
EXPOSE 8008
CMD ["./messaging"]
