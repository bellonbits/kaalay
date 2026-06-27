package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

type SMSClient struct {
	apiKey   string
	senderID string
	baseURL  string
	client   *http.Client
}

type ATSMSRequest struct {
	Username string `json:"username"`
	ApiKey   string `json:"api_key"`
	Recipients []struct {
		PhoneNumber string `json:"phoneNumber"`
		TextMessage string `json:"textMessage"`
	} `json:"recipients"`
}

type ATSMSResponse struct {
	SMSMessageData struct {
		Message []struct {
			MessageID         string `json:"MessageID"`
			Number            string `json:"number"`
			Status            string `json:"status"`
			Cost              string `json:"cost"`
			MessageParts      int    `json:"messageParts"`
			ErrorDescription  string `json:"errorDescription"`
		} `json:"Recipients"`
	} `json:"SMSMessageData"`
}

func NewSMSClient(apiKey, senderID string) *SMSClient {
	return &SMSClient{
		apiKey:   apiKey,
		senderID: senderID,
		baseURL:  "https://api.sandbox.africastalking.com/version1/messaging",
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// SendSMS sends an SMS via Africa's Talking
func (sc *SMSClient) SendSMS(ctx context.Context, phone, message string) (string, error) {
	if phone == "" || message == "" {
		return "", fmt.Errorf("phone and message are required")
	}

	// Ensure phone starts with +
	if phone[0:1] != "+" {
		phone = "+254" + phone[len(phone)-9:]
	}

	reqBody := map[string]interface{}{
		"username": sc.senderID,
		"ApiKey":   sc.apiKey,
		"message":  message,
		"recipients": []map[string]string{
			{
				"phoneNumber": phone,
			},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal SMS request")
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sc.baseURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		log.Error().Err(err).Msg("Failed to create SMS request")
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := sc.client.Do(req)
	if err != nil {
		log.Error().Err(err).Str("phone", phone).Msg("Failed to call SMS endpoint")
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		log.Warn().
			Int("status", resp.StatusCode).
			Bytes("body", body).
			Msg("SMS request failed")
		return "", fmt.Errorf("SMS request failed: %d", resp.StatusCode)
	}

	var smsResp ATSMSResponse
	if err := json.Unmarshal(body, &smsResp); err != nil {
		log.Warn().Err(err).Msg("Failed to parse SMS response")
		return "", nil // Still consider as sent even if parsing fails
	}

	if len(smsResp.SMSMessageData.Message) > 0 {
		result := smsResp.SMSMessageData.Message[0]

		if result.Status != "Success" {
			log.Warn().
				Str("phone", phone).
				Str("status", result.Status).
				Str("error", result.ErrorDescription).
				Msg("SMS delivery failed")
			return result.MessageID, nil
		}

		log.Info().
			Str("phone", phone).
			Str("message_id", result.MessageID).
			Str("cost", result.Cost).
			Msg("SMS sent successfully")

		return result.MessageID, nil
	}

	return "", fmt.Errorf("no recipients in response")
}

// SendSMSBatch sends SMS to multiple recipients
func (sc *SMSClient) SendSMSBatch(ctx context.Context, phones []string, message string) (map[string]string, error) {
	if len(phones) == 0 || message == "" {
		return nil, fmt.Errorf("phones and message are required")
	}

	// Normalize phone numbers
	recipients := make([]map[string]string, len(phones))
	for i, phone := range phones {
		if phone[0:1] != "+" {
			phone = "+254" + phone[len(phone)-9:]
		}
		recipients[i] = map[string]string{"phoneNumber": phone}
	}

	reqBody := map[string]interface{}{
		"username":   sc.senderID,
		"ApiKey":     sc.apiKey,
		"message":    message,
		"recipients": recipients,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sc.baseURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := sc.client.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to send batch SMS")
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var smsResp ATSMSResponse
	results := make(map[string]string)

	if err := json.Unmarshal(body, &smsResp); err != nil {
		log.Warn().Err(err).Msg("Failed to parse batch SMS response")
		return results, nil
	}

	for _, recipient := range smsResp.SMSMessageData.Message {
		results[recipient.Number] = recipient.MessageID
	}

	log.Info().
		Int("count", len(results)).
		Msg("Batch SMS sent")

	return results, nil
}
