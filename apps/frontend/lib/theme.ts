/**
 * Design System - Kaalay Super App
 * Premium, modern theme inspired by Uber, DoorDash, Bolt
 */

export const THEME = {
  colors: {
    // Primary
    primary: '#22C55E',
    primaryDark: '#16A34A',
    primaryLight: '#DCFCE7',

    // Backgrounds
    bg: '#F8FAFC',
    bgAlt: '#FFFFFF',
    bgOverlay: 'rgba(0, 0, 0, 0.5)',

    // Text
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',

    // States
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',

    // Borders
    border: '#E5E7EB',
    borderLight: '#F3F4F6',

    // Gradients
    gradientPrimary: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    gradientSuccess: 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
    '5xl': '48px',
  },

  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    card: '24px',
    full: '9999px',
  },

  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    hover: '0 20px 25px -5px rgba(34, 197, 94, 0.2)',
  },

  typography: {
    // Display
    display1: { fontSize: '48px', fontWeight: 700, lineHeight: '56px' },
    display2: { fontSize: '36px', fontWeight: 700, lineHeight: '44px' },

    // Headings
    h1: { fontSize: '32px', fontWeight: 700, lineHeight: '40px' },
    h2: { fontSize: '24px', fontWeight: 700, lineHeight: '32px' },
    h3: { fontSize: '20px', fontWeight: 600, lineHeight: '28px' },
    h4: { fontSize: '18px', fontWeight: 600, lineHeight: '26px' },

    // Body
    body1: { fontSize: '16px', fontWeight: 400, lineHeight: '24px' },
    body2: { fontSize: '14px', fontWeight: 400, lineHeight: '20px' },
    body3: { fontSize: '12px', fontWeight: 400, lineHeight: '18px' },

    // Labels
    label1: { fontSize: '14px', fontWeight: 600, lineHeight: '20px' },
    label2: { fontSize: '12px', fontWeight: 600, lineHeight: '16px' },
  },

  transitions: {
    fast: 'all 0.15s ease',
    base: 'all 0.2s ease',
    slow: 'all 0.3s ease',
  },
} as const;

export type Theme = typeof THEME;
