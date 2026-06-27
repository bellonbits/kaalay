package integrations

import (
	"context"
	"fmt"

	"cloud.google.com/go/messaging/apiv1/messagingpb"
	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"github.com/rs/zerolog/log"
)

type FCMClient struct {
	client *messaging.Client
}

func NewFCMClient(ctx context.Context) (*FCMClient, error) {
	app, err := firebase.NewApp(ctx, nil)
	if err != nil {
		log.Error().Err(err).Msg("Failed to initialize Firebase app")
		return nil, fmt.Errorf("failed to initialize firebase: %w", err)
	}

	client, err := app.Messaging(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get Messaging client")
		return nil, fmt.Errorf("failed to get messaging client: %w", err)
	}

	return &FCMClient{client: client}, nil
}

type PushNotification struct {
	DeviceToken string
	Title       string
	Body        string
	Data        map[string]string
	ImageURL    string
}

// SendPush sends a push notification via FCM
func (fc *FCMClient) SendPush(ctx context.Context, notif *PushNotification) (string, error) {
	if notif.DeviceToken == "" {
		return "", fmt.Errorf("device token is required")
	}

	message := &messaging.Message{
		Token: notif.DeviceToken,
		Notification: &messaging.Notification{
			Title: notif.Title,
			Body:  notif.Body,
		},
		Data: notif.Data,
	}

	// Add image URL for Android if provided
	if notif.ImageURL != "" {
		if message.Android == nil {
			message.Android = &messaging.AndroidConfig{}
		}
		message.Android.Notification = &messaging.AndroidNotification{
			ImageURL: notif.ImageURL,
		}

		// Add for iOS
		if message.APNS == nil {
			message.APNS = &messaging.APNSConfig{}
		}
		message.APNS.Payload = &messagingpb.APNSPayload{
			Aps: &messagingpb.Aps{
				MutableContent: true,
			},
		}
	}

	response, err := fc.client.Send(ctx, message)
	if err != nil {
		log.Error().
			Err(err).
			Str("device_token", notif.DeviceToken).
			Str("title", notif.Title).
			Msg("Failed to send push notification")
		return "", fmt.Errorf("failed to send push: %w", err)
	}

	log.Info().
		Str("device_token", notif.DeviceToken).
		Str("title", notif.Title).
		Str("message_id", response).
		Msg("Push notification sent successfully")

	return response, nil
}

// SendMulticast sends push notifications to multiple devices
func (fc *FCMClient) SendMulticast(ctx context.Context, tokens []string, notif *PushNotification) (*messaging.BatchResponse, error) {
	if len(tokens) == 0 {
		return nil, fmt.Errorf("at least one device token is required")
	}

	message := &messaging.MulticastMessage{
		Tokens: tokens,
		Notification: &messaging.Notification{
			Title: notif.Title,
			Body:  notif.Body,
		},
		Data: notif.Data,
	}

	if notif.ImageURL != "" {
		if message.Android == nil {
			message.Android = &messaging.AndroidConfig{}
		}
		message.Android.Notification = &messaging.AndroidNotification{
			ImageURL: notif.ImageURL,
		}
	}

	response, err := fc.client.SendMulticast(ctx, message)
	if err != nil {
		log.Error().
			Err(err).
			Int("token_count", len(tokens)).
			Msg("Failed to send multicast push notification")
		return nil, fmt.Errorf("failed to send multicast: %w", err)
	}

	log.Info().
		Int("success_count", response.SuccessCount).
		Int("failure_count", response.FailureCount).
		Msg("Multicast push notifications sent")

	return response, nil
}

// Close closes the FCM client
func (fc *FCMClient) Close() error {
	return fc.client.Close()
}
