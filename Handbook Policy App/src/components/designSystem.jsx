/**
 * CORE DESIGN SYSTEM (LOCKED)
 * 
 * These values define the structural foundation used across all apps.
 * DO NOT modify these without updating all linked applications.
 */

export const coreDesignSystem = {
  // Spacing scale (used for padding, margins, gaps)
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '0.75rem',    // 12px
    base: '1rem',     // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  // Border radius
  radius: {
    sm: '0.375rem',   // 6px - small elements
    md: '0.5rem',     // 8px - inputs, buttons
    lg: '0.75rem',    // 12px - cards
    xl: '1rem',       // 16px - modal, major containers
  },

  // Shadow depth
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },

  // Border width
  borderWidth: {
    base: '1px',
    thick: '2px',
  },

  // Typography scale
  typography: {
    sizes: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeights: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },

  // Layout structure
  layout: {
    sidebarWidth: {
      collapsed: '4rem',   // 64px
      expanded: '15rem',   // 240px
    },
    headerHeight: '3.5rem', // 56px
    maxContentWidth: '80rem', // 1280px
  },

  // Transitions
  transitions: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

/**
 * Helper function to generate CSS custom properties from design system
 */
export function generateCoreCSS() {
  const { spacing, radius, shadow, borderWidth, typography, layout, transitions } = coreDesignSystem;
  
  return `
    /* Spacing */
    ${Object.entries(spacing).map(([key, value]) => `--spacing-${key}: ${value};`).join('\n    ')}
    
    /* Border Radius */
    ${Object.entries(radius).map(([key, value]) => `--radius-${key}: ${value};`).join('\n    ')}
    
    /* Shadows */
    ${Object.entries(shadow).map(([key, value]) => `--shadow-${key}: ${value};`).join('\n    ')}
    
    /* Border Width */
    ${Object.entries(borderWidth).map(([key, value]) => `--border-${key}: ${value};`).join('\n    ')}
    
    /* Typography Sizes */
    ${Object.entries(typography.sizes).map(([key, value]) => `--text-${key}: ${value};`).join('\n    ')}
    
    /* Typography Weights */
    ${Object.entries(typography.weights).map(([key, value]) => `--font-${key}: ${value};`).join('\n    ')}
    
    /* Line Heights */
    ${Object.entries(typography.lineHeights).map(([key, value]) => `--leading-${key}: ${value};`).join('\n    ')}
    
    /* Layout */
    --sidebar-collapsed: ${layout.sidebarWidth.collapsed};
    --sidebar-expanded: ${layout.sidebarWidth.expanded};
    --header-height: ${layout.headerHeight};
    --max-content: ${layout.maxContentWidth};
    
    /* Transitions */
    --transition-fast: ${transitions.fast} ${transitions.easing};
    --transition-base: ${transitions.base} ${transitions.easing};
    --transition-slow: ${transitions.slow} ${transitions.easing};
  `;
}