FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY shared ./shared
COPY services/dispatch ./services/dispatch
RUN cd services/dispatch && go build -o dispatch cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/services/dispatch/dispatch .
EXPOSE 8005
CMD ["./dispatch"]
