// API Client - Connects to Tag-A-Long Backend
import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Use local backend for development, Vercel for production
// On web: use localhost
// On native (Expo Go): use computer's local IP address
const getBaseURL = () => {
  return 'https://tag-a-long-api.vercel.app/api';
};

const BASE_URL = getBaseURL();

class APIClient {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000, // Increased to 30 seconds for image uploads
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Initialize token from storage
    this.initializeToken();

    // Add request interceptor to attach auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or revoked — clear everything and navigate to login
          this.authToken = null;
          await AsyncStorage.multiRemove(['auth_token', 'user', 'profileSetupComplete']);
          const { navigateToAuth } = await import('../navigation/navigationRef');
          navigateToAuth();
        }
        return Promise.reject(error);
      }
    );
  }

  // Initialize token from AsyncStorage on app start
  private async initializeToken() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        this.authToken = token;
      }
    } catch (error) {
      console.error('Error initializing auth token:', error);
    }
  }

  // Get the axios instance
  getInstance(): AxiosInstance {
    return this.client;
  }

  // Set auth token (updates both memory and storage)
  async setAuthToken(token: string) {
    this.authToken = token;
    await AsyncStorage.setItem('auth_token', token);
  }

  // Clear auth token (clears both memory and storage)
  async clearAuthToken() {
    this.authToken = null;
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
  }
}

export default new APIClient();
