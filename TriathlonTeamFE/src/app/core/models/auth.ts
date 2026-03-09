export type Role = 'ADMIN' | 'CLUB' | 'COACH' | 'PARENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  oauthProvider?: string | null;
  avatarUrl?: string | null;
  needsProfileCompletion: boolean;
}

export interface AuthResponse {
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterParentRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface CompleteProfileRequest {
  phone: string;
  name?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// Coach Registration
export interface RegisterCoachRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  invitationCode: string;
  bio?: string;
  sportIds?: string[];
  hasCompany?: boolean;
  companyName?: string;
  companyCui?: string;
  companyRegNumber?: string;
  companyAddress?: string;
  bankAccount?: string;
  bankName?: string;
}

export interface CoachRegistrationResponse extends AuthResponse {
  stripeOnboardingUrl?: string;
  requiresStripeOnboarding: boolean;
}

// Stripe Account Status
export interface StripeAccountStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requiresAction: boolean;
  canReceivePayments: boolean;
  // Payment routing info
  paymentDestination: 'COACH' | 'CLUB' | 'NONE';
  clubName?: string;
  clubCanReceivePayments: boolean;
}

export interface OnboardingLinkResponse {
  url: string;
}

// Club Registration
export interface RegisterClubRequest {
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  clubName: string;
  description?: string;
  clubPhone?: string;
  clubEmail?: string;
  address?: string;
  city?: string;
  website?: string;
  sportIds?: string[];
}

export interface ClubRegistrationResponse extends AuthResponse {
  clubId: string;
  clubName: string;
  stripeOnboardingUrl?: string;
  requiresStripeOnboarding: boolean;
}

export interface ValidateClubCodeRequest {
  code: string;
}

export interface ClubCodeValidationResponse {
  valid: boolean;
  message: string;
  clubName?: string;
}