package service

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/notification/config"
	"github.com/suqafuran/express/services/notification/internal/integrations"
	"github.com/suqafuran/express/services/notification/internal/model"
	"github.com/suqafuran/express/services/notification/internal/repository"
)

type NotificationService struct {
	repo      repository.NotificationRepository
	fcmClient *integrations.FCMClient
	smsClient *integrations.SMSClient
	emailClient *integrations.EmailClient
	redis     *redis.Client
	config    *config.Config
}

func NewNotificationService(
	repo repository.NotificationRepository,
	fcmClient *integrations.FCMClient,
	smsClient *integrations.SMSClient,
	emailClient *integrations.EmailClient,
	redis *redis.Client,
	cfg *config.Config,
) *NotificationService {
	return &NotificationService{
		repo:        repo,
		fcmClient:   fcmClient,
		smsClient:   smsClient,
		emailClient: emailClient,
		redis:       redis,
		config:      cfg,
	}
}

// SendNotification sends notification via user's preferred channels
func (ns *NotificationService) SendNotification(ctx context.Context, notif *model.Notification) error {
	// Get user preferences
	pref, err := ns.repo.GetOrCreatePreference(ctx, notif.RecipientID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get user preferences")
		return err
	}

	// Store notification record
	if err := ns.repo.CreateNotification(ctx, notif); err != nil {
		log.Error().Err(err).Msg("Failed to create notification record")
		return err
	}

	// Send via enabled channels
	if pref.PushEnabled {
		ns.sendPush(ctx, notif, pref)
	}

	if pref.SMSEnabled {
		ns.sendSMS(ctx, notif, pref)
	}

	if pref.EmailEnabled {
		ns.sendEmail(ctx, notif, pref)
	}

	return nil
}

// sendPush sends push notification via FCM
func (ns *NotificationService) sendPush(ctx context.Context, notif *model.Notification, pref *model.NotificationPreference) {
	if ns.fcmClient == nil {
		log.Warn().Msg("FCM client not configured")
		return
	}

	// Get device tokens from Redis
	key := fmt.Sprintf("devices:%s", notif.RecipientID)
	devices, err := ns.redis.SMembers(ctx, key).Val(), nil
	if err != nil || len(devices) == 0 {
		log.Debug().Str("user_id", notif.RecipientID).Msg("No device tokens found")
		return
	}

	// Get title and body for user's language
	title := notif.TitleEn
	body := notif.BodyEn

	if pref.Language == "so" && notif.TitleSo != "" {
		title = notif.TitleSo
		body = notif.BodySo
	}

	// Send to all devices
	response, err := ns.fcmClient.SendMulticast(ctx, devices, &integrations.PushNotification{
		Title: title,
		Body:  body,
		Data: map[string]string{
			"notification_id": notif.ID,
			"event_type":      notif.EventType,
		},
		ImageURL: extractImageFromData(notif.Data),
	})

	if err != nil {
		log.Error().Err(err).Msg("Failed to send push notification")
		_ = ns.createNotificationLog(ctx, notif.ID, "push", "", "error", err.Error())
		return
	}

	// Log failed device tokens for removal
	for _, resp := range response.Responses {
		if !resp.Success {
			log.Warn().
				Str("user_id", notif.RecipientID).
				Str("error", resp.Error.Error()).
				Msg("Push notification failed for device")
		}
	}

	log.Info().
		Str("notification_id", notif.ID).
		Int("success", response.SuccessCount).
		Int("failure", response.FailureCount).
		Msg("Push notifications sent")

	_ = ns.createNotificationLog(ctx, notif.ID, "push", devices[0], "sent", "")
}

// sendSMS sends SMS notification
func (ns *NotificationService) sendSMS(ctx context.Context, notif *model.Notification, pref *model.NotificationPreference) {
	if ns.smsClient == nil {
		log.Warn().Msg("SMS client not configured")
		return
	}

	phone := extractPhoneFromData(notif.Data)
	if phone == "" {
		log.Debug().Str("notification_id", notif.ID).Msg("No phone number found for SMS")
		return
	}

	// Prepare SMS body
	body := notif.BodyEn
	if pref.Language == "so" && notif.BodySo != "" {
		body = notif.BodySo
	}

	reference, err := ns.smsClient.SendSMS(ctx, phone, body)
	if err != nil {
		log.Error().Err(err).Msg("Failed to send SMS")
		_ = ns.createNotificationLog(ctx, notif.ID, "sms", phone, "error", err.Error())
		return
	}

	log.Info().
		Str("notification_id", notif.ID).
		Str("phone", phone).
		Str("reference", reference).
		Msg("SMS sent")

	_ = ns.createNotificationLog(ctx, notif.ID, "sms", phone, "sent", reference)
}

// sendEmail sends email notification
func (ns *NotificationService) sendEmail(ctx context.Context, notif *model.Notification, pref *model.NotificationPreference) {
	if ns.emailClient == nil {
		log.Warn().Msg("Email client not configured")
		return
	}

	email := extractEmailFromData(notif.Data)
	if email == "" {
		log.Debug().Str("notification_id", notif.ID).Msg("No email found for email notification")
		return
	}

	// Get email template
	htmlBody := integrations.GetEmailTemplate(notif.Template, pref.Language, convertDataToStrings(notif.Data))

	reference, err := ns.emailClient.SendEmail(ctx, &integrations.EmailMessage{
		ToEmail:  email,
		Subject:  notif.TitleEn,
		HTMLBody: htmlBody,
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to send email")
		_ = ns.createNotificationLog(ctx, notif.ID, "email", email, "error", err.Error())
		return
	}

	log.Info().
		Str("notification_id", notif.ID).
		Str("email", email).
		Str("reference", reference).
		Msg("Email sent")

	_ = ns.createNotificationLog(ctx, notif.ID, "email", email, "sent", reference)
}

// createNotificationLog stores channel-specific delivery log
func (ns *NotificationService) createNotificationLog(ctx context.Context, notifID, channel, recipient, status, errorMsg string) error {
	log := &model.NotificationLog{
		NotificationID:   notifID,
		Channel:          channel,
		Recipient:        recipient,
		Status:           status,
		ProviderResponse: "",
		ErrorMessage:     errorMsg,
		CreatedAt:        time.Now(),
	}

	if status == "sent" {
		log.SentAt = &time.Time{}
		*log.SentAt = time.Now()
	}

	return ns.repo.CreateNotificationLog(ctx, log)
}

// Helper functions

func extractPhoneFromData(data map[string]interface{}) string {
	if phone, ok := data["phone"].(string); ok {
		return phone
	}
	return ""
}

func extractEmailFromData(data map[string]interface{}) string {
	if email, ok := data["email"].(string); ok {
		return email
	}
	return ""
}

func extractImageFromData(data map[string]interface{}) string {
	if img, ok := data["image_url"].(string); ok {
		return img
	}
	return ""
}

func convertDataToStrings(data map[string]interface{}) map[string]string {
	result := make(map[string]string)
	for k, v := range data {
		if str, ok := v.(string); ok {
			result[k] = str
		}
	}
	return result
}
