FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/auth ./services/auth
RUN cd services/auth && go build -o auth cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/auth/auth .
EXPOSE 8001
CMD ["./auth"]
