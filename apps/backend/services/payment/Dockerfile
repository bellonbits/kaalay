FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/payment ./services/payment
RUN cd services/payment && go build -o payment cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/payment/payment .
EXPOSE 8010
CMD ["./payment"]
