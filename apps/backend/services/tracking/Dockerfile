FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/tracking ./services/tracking
RUN cd services/tracking && go build -o tracking cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/tracking/tracking .
EXPOSE 8007
CMD ["./tracking"]
