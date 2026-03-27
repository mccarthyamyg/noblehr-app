/**
 * APP THEME CONFIGURATION (CUSTOMIZABLE)
 * 
 * These values can be customized per app while maintaining the core design system structure.
 * Future enhancement: Theme profiles can be linked across multiple apps.
 */

export const appTheme = {
  // App identification (for future theme profile linking)
  id: 'noble_hr',
  name: 'Noble HR',
  
  // Theme profile metadata (reserved for future cross-app linking)
  profile: {
    id: null, // Will be set when linked to a shared profile
    name: 'Default',
    linkedApps: [], // Future: List of app IDs sharing this profile
  },

  // Customizable color palette (Noble_HR_Rebrand_v2: app primary = deep blue; master brand = forest + royal purple)
  colors: {
    nobleMaster: {
      forest: '#1B4332',
      purple: '#4C1D95',
    },
    // Primary brand color — Noble HR module blue (#1E40AF)
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#1e40af',
      600: '#1d4ed8',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },

    // Royal purple accent (Noble master brand — use sparingly vs day-to-day blue UI)
    accent: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#a78bfa',
      500: '#6d28d9',
      600: '#5b21b6',
      700: '#4c1d95',
      800: '#3b0764',
      900: '#2e1065',
    },

    // Semantic colors (typically locked, but can be adjusted)
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Neutral palette (base grays)
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },

  // Typography (font family can be customized)
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },
  },

  // Icon styling preferences
  icons: {
    tone: 'rounded', // 'rounded' | 'sharp' | 'outlined'
    strokeWidth: '2', // For outline-style icons
  },

  // Interaction states
  states: {
    hoverOpacity: '0.9',
    activeScale: '0.98',
    focusRingColor: 'rgba(30, 64, 175, 0.45)',
    focusRingWidth: '3px',
  },
};

/**
 * Generate CSS custom properties from theme configuration
 */
export function generateThemeCSS(theme = appTheme) {
  const { colors, typography, icons, states } = theme;
  const noble = colors.nobleMaster || {};

  return `
    --color-noble-forest: ${noble.forest || '#1B4332'};
    --color-noble-purple: ${noble.purple || '#4C1D95'};
    /* Primary Colors */
    ${Object.entries(colors.primary).map(([key, value]) => `--color-primary-${key}: ${value};`).join('\n    ')}
    
    /* Accent Colors */
    ${Object.entries(colors.accent).map(([key, value]) => `--color-accent-${key}: ${value};`).join('\n    ')}
    
    /* Semantic Colors */
    --color-success: ${colors.success};
    --color-warning: ${colors.warning};
    --color-error: ${colors.error};
    --color-info: ${colors.info};
    
    /* Neutral Colors */
    ${Object.entries(colors.neutral).map(([key, value]) => `--color-neutral-${key}: ${value};`).join('\n    ')}
    
    /* Typography */
    --font-sans: ${typography.fontFamily.sans};
    --font-mono: ${typography.fontFamily.mono};
    
    /* Interaction States */
    --hover-opacity: ${states.hoverOpacity};
    --active-scale: ${states.activeScale};
    --focus-ring: ${states.focusRingWidth} solid ${states.focusRingColor};
  `;
}

/**
 * Future enhancement: Theme profile management
 * 
 * These functions are placeholders for cross-app theme syncing
 */

export async function loadThemeProfile(profileId) {
  // Future: Fetch theme profile from shared storage
  // For now, returns default theme
  return appTheme;
}

export async function saveThemeProfile(theme) {
  // Future: Save theme profile to shared storage
  // Future: Notify linked apps of theme changes
  console.log('Theme profile saved:', theme.profile.name);
}

export function linkThemeProfile(profileId, appIds) {
  // Future: Link multiple apps to share the same theme profile
  // Future: Set up real-time sync for theme changes
  console.log('Linking theme profile:', profileId, 'to apps:', appIds);
}

/**
 * Utility: Get current theme with fallbacks
 */
export function getCurrentTheme() {
  // Future: Check for linked profile first
  // Future: Merge profile colors with app-specific overrides
  return appTheme;
}