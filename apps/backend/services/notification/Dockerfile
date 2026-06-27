FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/notification ./services/notification
RUN cd services/notification && go build -o notification cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/notification/notification .
EXPOSE 8009
CMD ["./notification"]
