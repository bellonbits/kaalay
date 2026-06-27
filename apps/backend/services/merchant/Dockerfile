FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/merchant ./services/merchant
RUN cd services/merchant && go build -o merchant cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/merchant/merchant .
EXPOSE 8003
CMD ["./merchant"]
