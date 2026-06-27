FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/gateway ./services/gateway
RUN cd services/gateway && go build -o gateway cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/gateway/gateway .
EXPOSE 8000
CMD ["./gateway"]
