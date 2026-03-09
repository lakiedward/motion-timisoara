import axios from 'axios';
import { API_BASE_URL } from '../config/env';

let accessToken: string | null = null;

export const setHttpAccessToken = (token: string | null) => {
  accessToken = token;
};

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
});

httpClient.interceptors.request.use((config) => {
  if (accessToken) {
    if (!config.headers) {
      config.headers = {} as any;
    }
    (config.headers as any).Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
