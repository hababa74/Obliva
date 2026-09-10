// Obliva — Dunkles Theme (Tiefblau/Violett)

export const colors = {
  background: '#0f1226',
  surface: '#1a1f3d',
  surfaceLight: '#252b52',
  primary: '#7c6cf5',
  primaryDark: '#5a48d4',
  accent: '#4cd7c6',
  text: '#eef0ff',
  textMuted: '#9aa0c3',
  userBubble: '#7c6cf5',
  assistantBubble: '#1a1f3d',
  error: '#f56c6c',
  success: '#4cd787',
  warning: '#f5c96c',
  border: '#2e3560',
} as const;

export const entityColors: Record<string, string> = {
  person: '#6ca8f5',
  authority: '#f56c6c',
  doctor: '#4cd787',
  organization: '#f5c96c',
  location: '#4cd7c6',
  topic: '#b06cf5',
  document: '#9aa0c3',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
