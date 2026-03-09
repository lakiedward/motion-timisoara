import { TextStyle } from 'react-native';

// ============================================================================
// COLORS (Consistent with Web)
// ============================================================================
export const colors = {
  // Primary colors
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryLight: '#dbeafe',
  primaryDark: '#1e40af',
  
  // Semantic colors
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  // Backwards-compatible alias used in some screens
  danger: '#ef4444',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  
  // Neutral colors
  surface: '#ffffff',
  background: '#f8fafc',
  backgroundDark: '#f1f5f9',
  
  // Text colors
  text: '#1e293b',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textDisabled: '#94a3b8',
  
  // Border colors
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  borderDark: '#cbd5e1',
  
  // Sport-specific colors (for course badges)
  swimming: '#06b6d4',
  running: '#f59e0b',
  cycling: '#8b5cf6',
  triathlon: '#ec4899',
};

// ============================================================================
// TYPOGRAPHY (Consistent with Web)
// ============================================================================
export const typography = {
  // Headings
  h1: {
    fontSize: 32,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  
  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  
  // Captions
  caption: {
    fontSize: 12,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 16,
  },
  captionSmall: {
    fontSize: 11,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 14,
  },
  
  // Buttons
  button: {
    fontSize: 16,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
};

// ============================================================================
// SPACING (Consistent with Web)
// ============================================================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  
  screenPadding: 16,
  cardPadding: 16,
  sectionSpacing: 24,
  cardGap: 16,
};

// ============================================================================
// RADII (Border Radius)
// ============================================================================
export const radii = {
  sm: 4,
  small: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  card: 12,
  button: 8,
  input: 8,
  pill: 9999,
  full: 9999,
};

// ============================================================================
// SHADOWS (Consistent with Web)
// ============================================================================
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
};

// ============================================================================
// GRADIENTS (Optional, for hero sections)
// ============================================================================
export const gradients = {
  primary: ['#3b82f6', '#2563eb'],
  success: ['#10b981', '#059669'],
  hero: ['#1e40af', '#3b82f6', '#60a5fa'],
};
