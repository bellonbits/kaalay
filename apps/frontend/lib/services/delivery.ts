import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_DELIVERY_API || 'http://localhost:8006';

export interface DeliveryOffer {
  id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  delivery_fee: number;
  estimated_distance: number;
  estimated_duration: number;
  order_type: string;
  special_instructions?: string;
  expires_at: string;
  created_at: string;
}

export interface ActiveDelivery {
  id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  status: 'pending' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
  eta_minutes: number;
}

export interface DeliveryEarnings {
  id: string;
  driver_id: string;
  order_id: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  paid_at: string;
  created_at: string;
}

export interface DeliveryWallet {
  driver_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  currency: string;
}

export const deliveryAPI = {
  // Delivery Offers
  getOffers: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/drivers/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as DeliveryOffer[];
  },

  acceptOffer: async (token: string, offerId: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/drivers/offers/${offerId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data as ActiveDelivery;
  },

  rejectOffer: async (token: string, offerId: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/drivers/offers/${offerId}/reject`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Active Deliveries
  getActiveDeliveries: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/drivers/deliveries/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as ActiveDelivery[];
  },

  getDelivery: async (token: string, deliveryId: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/v1/drivers/deliveries/${deliveryId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data as ActiveDelivery;
  },

  updateDeliveryStatus: async (
    token: string,
    deliveryId: string,
    status: 'picked_up' | 'in_transit' | 'delivered'
  ) => {
    const response = await axios.patch(
      `${API_BASE_URL}/v1/drivers/deliveries/${deliveryId}/status`,
      { status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data as ActiveDelivery;
  },

  submitProofOfDelivery: async (
    token: string,
    deliveryId: string,
    imageUrl: string,
    notes?: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/drivers/deliveries/${deliveryId}/proof`,
      { image_url: imageUrl, notes },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  // Earnings
  getEarnings: async (token: string, limit = 20, offset = 0) => {
    const response = await axios.get(
      `${API_BASE_URL}/v1/drivers/earnings?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data as DeliveryEarnings[];
  },

  getTodayEarnings: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/drivers/earnings/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  },

  // Wallet
  getWallet: async (token: string, driverId: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/wallets/${driverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as DeliveryWallet;
  },
};
