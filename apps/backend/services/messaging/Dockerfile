FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/messaging ./services/messaging
RUN cd services/messaging && go build -o messaging cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/messaging/messaging .
EXPOSE 8008
CMD ["./messaging"]
