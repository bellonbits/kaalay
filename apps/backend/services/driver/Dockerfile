FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/driver ./services/driver
RUN cd services/driver && go build -o driver cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/driver/driver .
EXPOSE 8006
CMD ["./driver"]
