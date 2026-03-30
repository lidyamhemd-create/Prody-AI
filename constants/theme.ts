// ProdyAI Design System
// Dark, warm, RPG-meets-productivity aesthetic
 
export const colors = {
  // Backgrounds
  background: '#0f0f14',
  surface: '#16141e',
  surfaceHighlight: '#1e1c28',
  surfaceDeep: '#0a0a0f',
 
  // Borders
  border: '#2a2838',
  borderAccent: '#3a3848',
 
  // Text
  textPrimary: '#e8e0cc',
  textSecondary: '#9a9080',
  textMuted: '#5a5468',
 
  // Accents
  gold: '#EF9F27',
  goldDim: '#EF9F2722',
  green: '#1D9E75',
  greenDim: '#1D9E7522',
  purple: '#7F77DD',
  purpleDim: '#7F77DD22',
  blue: '#378ADD',
  blueDim: '#378ADD22',
  pink: '#D4537E',
 
  // Status
  error: '#FF5252',
  success: '#1D9E75',
  warning: '#EF9F27',
};
 
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
 
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
 
// react-native-paper dark theme override
export const paperTheme = {
  dark: true,
  roundness: 12,
  colors: {
    primary: colors.purple,
    secondary: colors.gold,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceHighlight,
    onSurface: colors.textPrimary,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.border,
    error: colors.error,
    onPrimary: colors.textPrimary,
    onSecondary: colors.background,
    onBackground: colors.textPrimary,
    elevation: {
      level0: 'transparent',
      level1: colors.surface,
      level2: colors.surfaceHighlight,
      level3: colors.surfaceHighlight,
      level4: colors.surfaceHighlight,
      level5: colors.surfaceHighlight,
    },
  },
};