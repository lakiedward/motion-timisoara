import { Platform } from 'react-native';

const DEV_BASE_URL = 'https://api.motiontimisoara.com';
const PROD_BASE_URL = 'https://api.motiontimisoara.com';

export const API_BASE_URL = __DEV__ ? DEV_BASE_URL : PROD_BASE_URL;

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_REPLACE_ME_WITH_REAL_KEY';
