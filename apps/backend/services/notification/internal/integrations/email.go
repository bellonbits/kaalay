package integrations

import (
	"context"
	"fmt"

	"github.com/rs/zerolog/log"
	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

type EmailClient struct {
	client    *sendgrid.Client
	fromEmail string
	fromName  string
}

func NewEmailClient(apiKey, fromEmail string) *EmailClient {
	return &EmailClient{
		client:    sendgrid.NewSendClient(apiKey),
		fromEmail: fromEmail,
		fromName:  "Suqafuran Express",
	}
}

type EmailMessage struct {
	ToEmail   string
	ToName    string
	Subject   string
	PlainText string
	HTMLBody  string
}

// SendEmail sends an email via SendGrid
func (ec *EmailClient) SendEmail(ctx context.Context, msg *EmailMessage) (string, error) {
	if msg.ToEmail == "" {
		return "", fmt.Errorf("recipient email is required")
	}

	from := mail.NewEmail(ec.fromName, ec.fromEmail)
	to := mail.NewEmail(msg.ToName, msg.ToEmail)

	content := mail.NewContent("text/plain", msg.PlainText)
	if msg.HTMLBody != "" {
		content = mail.NewContent("text/html", msg.HTMLBody)
	}

	m := mail.NewSingleEmail(from, msg.Subject, to, content)

	response, err := ec.client.SendWithContext(ctx, m)
	if err != nil {
		log.Error().
			Err(err).
			Str("to_email", msg.ToEmail).
			Str("subject", msg.Subject).
			Msg("Failed to send email")
		return "", fmt.Errorf("failed to send email: %w", err)
	}

	if response.StatusCode >= 400 {
		log.Warn().
			Int("status", response.StatusCode).
			Str("body", response.Body).
			Str("to_email", msg.ToEmail).
			Msg("Email request failed")
		return "", fmt.Errorf("email request failed: %d", response.StatusCode)
	}

	messageID := response.Headers.Get("X-Message-ID")
	log.Info().
		Str("to_email", msg.ToEmail).
		Str("subject", msg.Subject).
		Str("message_id", messageID).
		Msg("Email sent successfully")

	return messageID, nil
}

// SendBatch sends emails to multiple recipients
func (ec *EmailClient) SendBatch(ctx context.Context, messages []*EmailMessage) (map[string]string, error) {
	results := make(map[string]string)

	for _, msg := range messages {
		messageID, err := ec.SendEmail(ctx, msg)
		if err != nil {
			log.Warn().
				Err(err).
				Str("to_email", msg.ToEmail).
				Msg("Failed to send batch email")
			results[msg.ToEmail] = "error"
			continue
		}
		results[msg.ToEmail] = messageID
	}

	return results, nil
}

// GetEmailTemplateHTML returns HTML templates for common email types
func GetEmailTemplate(templateType, language string, data map[string]string) string {
	switch templateType {
	case "order_created":
		return orderCreatedTemplate(language, data)
	case "order_accepted":
		return orderAcceptedTemplate(language, data)
	case "delivery_completed":
		return deliveryCompletedTemplate(language, data)
	case "payment_received":
		return paymentReceivedTemplate(language, data)
	default:
		return ""
	}
}

func orderCreatedTemplate(language string, data map[string]string) string {
	if language == "so" {
		return fmt.Sprintf(`
			<h2>Waad ku adeegsanaysaa Suqafuran Express</h2>
			<p>Iska warran! Ogeysyada koobadkaaga waxaa lagu qaatay.</p>
			<p>Lambarka codsiga: %s</p>
			<p>Qiimaha: KES %s</p>
			<p>Waxaan ku soo daynaa marka hore...</p>
		`, data["order_id"], data["amount"])
	}
	return fmt.Sprintf(`
		<h2>Welcome to Suqafuran Express</h2>
		<p>Great! Your order has been received.</p>
		<p>Order ID: %s</p>
		<p>Amount: KES %s</p>
		<p>Your delivery will arrive shortly...</p>
	`, data["order_id"], data["amount"])
}

func orderAcceptedTemplate(language string, data map[string]string) string {
	if language == "so" {
		return fmt.Sprintf(`
			<h2>Codsiga Ayaa Loo Qaatay</h2>
			<p>Turjuubaha %s wuxuu soo maray.</p>
			<p>Waxaan ku imaan doona marka hore...</p>
		`, data["driver_name"])
	}
	return fmt.Sprintf(`
		<h2>Order Accepted</h2>
		<p>Driver %s is heading your way.</p>
		<p>Estimated time: %s minutes</p>
	`, data["driver_name"], data["eta"])
}

func deliveryCompletedTemplate(language string, data map[string]string) string {
	if language == "so" {
		return fmt.Sprintf(`
			<h2>Codsiga Ayaa Loo Soo Dhaweeyay</h2>
			<p>Mahadsanid adigoo adeegsan Suqafuran Express.</p>
			<p>Rate the driver: %s</p>
		`, data["rating_url"])
	}
	return fmt.Sprintf(`
		<h2>Delivery Completed</h2>
		<p>Thank you for using Suqafuran Express!</p>
		<p>Rate your driver: %s</p>
	`, data["rating_url"])
}

func paymentReceivedTemplate(language string, data map[string]string) string {
	if language == "so" {
		return fmt.Sprintf(`
			<h2>Lacag Loo Qaatay</h2>
			<p>Waad noo bixiyay KES %s.</p>
			<p>Mahadsanid!</p>
		`, data["amount"])
	}
	return fmt.Sprintf(`
		<h2>Payment Received</h2>
		<p>We received your payment of KES %s.</p>
		<p>Thank you!</p>
	`, data["amount"])
}
