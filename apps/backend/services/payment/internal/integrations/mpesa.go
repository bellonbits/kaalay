package integrations

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

type MpesaClient struct {
	consumerKey    string
	consumerSecret string
	shortCode      string
	passkey        string
	lipanaURL      string
	callbackURL    string
	httpClient     *http.Client
	accessToken    string
	tokenExpiresAt time.Time
}

type MpesaOAuthResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

type MpesaSTKPushRequest struct {
	BusinessShortCode string `json:"BusinessShortCode"`
	Password          string `json:"Password"`
	Timestamp         string `json:"Timestamp"`
	TransactionType   string `json:"TransactionType"`
	Amount            int    `json:"Amount"`
	PartyA            string `json:"PartyA"`
	PartyB            string `json:"PartyB"`
	PhoneNumber       string `json:"PhoneNumber"`
	CallBackURL       string `json:"CallBackURL"`
	AccountReference  string `json:"AccountReference"`
	TransactionDesc   string `json:"TransactionDesc"`
}

type MpesaSTKPushResponse struct {
	MerchantRequestID   string `json:"MerchantRequestID"`
	CheckoutRequestID   string `json:"CheckoutRequestID"`
	ResponseCode        string `json:"ResponseCode"`
	ResponseDescription string `json:"ResponseDescription"`
	CustomerMessage     string `json:"CustomerMessage"`
}

func NewMpesaClient(consumerKey, consumerSecret, shortCode, passkey, lipanaURL, callbackURL string) *MpesaClient {
	// Allow self-signed certificates for testing, but validate in production
	tlsConfig := &tls.Config{}
	transport := &http.Transport{TLSClientConfig: tlsConfig}

	return &MpesaClient{
		consumerKey:    consumerKey,
		consumerSecret: consumerSecret,
		shortCode:      shortCode,
		passkey:        passkey,
		lipanaURL:      lipanaURL,
		callbackURL:    callbackURL,
		httpClient: &http.Client{
			Timeout:   30 * time.Second,
			Transport: transport,
		},
	}
}

// GetAccessToken retrieves or refreshes the OAuth access token
func (mc *MpesaClient) GetAccessToken(ctx context.Context) (string, error) {
	// Return cached token if still valid
	if mc.accessToken != "" && time.Now().Before(mc.tokenExpiresAt) {
		return mc.accessToken, nil
	}

	// Generate new token
	auth := base64.StdEncoding.EncodeToString(
		[]byte(mc.consumerKey + ":" + mc.consumerSecret),
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
		nil,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create OAuth request")
		return "", err
	}

	req.Header.Set("Authorization", "Basic "+auth)

	resp, err := mc.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to call OAuth endpoint")
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Error().
			Int("status", resp.StatusCode).
			Bytes("body", body).
			Msg("OAuth request failed")
		return "", errors.New("failed to get access token")
	}

	var oauthResp MpesaOAuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&oauthResp); err != nil {
		log.Error().Err(err).Msg("Failed to decode OAuth response")
		return "", err
	}

	// Cache token (expires in 3599 seconds, refresh after 3500)
	mc.accessToken = oauthResp.AccessToken
	mc.tokenExpiresAt = time.Now().Add(time.Duration(oauthResp.ExpiresIn-99) * time.Second)

	log.Info().
		Str("token_type", oauthResp.TokenType).
		Int("expires_in", oauthResp.ExpiresIn).
		Msg("M-Pesa access token generated")

	return mc.accessToken, nil
}

// InitiateSTKPush initiates an M-Pesa STK push
func (mc *MpesaClient) InitiateSTKPush(ctx context.Context, req *MpesaSTKPushRequest) (*MpesaSTKPushResponse, error) {
	token, err := mc.GetAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	body, err := json.Marshal(req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal STK push request")
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		mc.lipanaURL,
		bytes.NewBuffer(body),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create STK push request")
		return nil, err
	}

	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := mc.httpClient.Do(httpReq)
	if err != nil {
		log.Error().Err(err).Msg("Failed to call STK push endpoint")
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Error().
			Int("status", resp.StatusCode).
			Bytes("body", bodyBytes).
			Str("url", mc.lipanaURL).
			Msg("STK push request failed")
		return nil, fmt.Errorf("STK push failed: %d", resp.StatusCode)
	}

	var stkResp MpesaSTKPushResponse
	if err := json.NewDecoder(resp.Body).Decode(&stkResp); err != nil {
		log.Error().Err(err).Msg("Failed to decode STK push response")
		return nil, err
	}

	if stkResp.ResponseCode != "0" {
		log.Warn().
			Str("response_code", stkResp.ResponseCode).
			Str("message", stkResp.ResponseDescription).
			Msg("M-Pesa STK push returned error code")
		return nil, fmt.Errorf("M-Pesa error: %s", stkResp.ResponseDescription)
	}

	log.Info().
		Str("merchant_request_id", stkResp.MerchantRequestID).
		Str("checkout_request_id", stkResp.CheckoutRequestID).
		Str("customer_message", stkResp.CustomerMessage).
		Msg("M-Pesa STK push initiated successfully")

	return &stkResp, nil
}

// BuildSTKPushRequest constructs an STK push request with proper formatting
func (mc *MpesaClient) BuildSTKPushRequest(amount int, phone, accountRef, description string) *MpesaSTKPushRequest {
	timestamp := time.Now().Format("20060102150405")

	// Password = base64(BusinessShortCode + Passkey + Timestamp)
	passwordStr := mc.shortCode + mc.passkey + timestamp
	password := base64.StdEncoding.EncodeToString([]byte(passwordStr))

	// Format phone: remove leading 0 if present, ensure +254 prefix
	if phone[0:1] == "0" {
		phone = "254" + phone[1:]
	} else if phone[0:3] != "254" {
		phone = "254" + phone
	}

	return &MpesaSTKPushRequest{
		BusinessShortCode: mc.shortCode,
		Password:          password,
		Timestamp:         timestamp,
		TransactionType:   "CustomerPayBillOnline",
		Amount:            amount,
		PartyA:            phone,
		PartyB:            mc.shortCode,
		PhoneNumber:       phone,
		CallBackURL:       mc.callbackURL,
		AccountReference:  accountRef,
		TransactionDesc:   description,
	}
}
