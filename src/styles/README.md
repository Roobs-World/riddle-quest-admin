# Qwordly Design System

A modular, scalable design system for the Qwordly React Native app.

## Architecture Overview

The styles have been broken down into a modular structure for better maintainability, reusability, and developer experience:

```
src/styles/
├── README.md                    # This documentation
├── index.ts                     # Main entry point
├── styles.ts                    # Legacy compatibility layer
├── styles.ts.backup            # Original monolithic file (backup)
├── tokens/                      # Design tokens
│   ├── colors.ts               # Color palette
│   ├── typography.ts           # Font families, sizes, line heights
│   ├── spacing.ts              # Spacing scale
│   ├── sizing.ts               # Component sizing standards
│   ├── borderRadius.ts         # Border radius values
│   └── shadows.ts              # Shadow/elevation definitions
├── components/                  # Component-specific styles
│   ├── index.ts                # Aggregates all component styles
│   ├── layout.ts               # Container, positioning styles
│   ├── buttons.ts              # Button-related styles
│   ├── text.ts                 # Typography styles
│   ├── modals.ts               # Modal and overlay styles
│   ├── game.ts                 # Game-specific UI styles
│   ├── forms.ts                # Form and input styles
│   └── animations.ts           # Animation and effect styles
└── utils/                       # Utility functions
    ├── createShadow.ts         # Shadow generation utility
    ├── createButtonStyle.ts    # Button style generator
    └── createResponsivePadding.ts # Responsive padding utility
```

## Import Patterns

### Legacy Compatibility (Existing Code)

```typescript
// Existing imports continue to work unchanged
import { styles, COLORS } from "../../styles/styles";
import { styles, COLORS } from "../styles/styles";
```

### Modern Modular Imports (Recommended for New Code)

```typescript
// Import specific design tokens
import { COLORS, TYPOGRAPHY, SPACING } from "../styles";

// Import specific component styles
import { layoutStyles, buttonStyles, textStyles } from "../styles";

// Import utility functions
import { createButtonStyle, createShadow } from "../styles";

// Import everything (for comprehensive usage)
import { styles, COLORS, TYPOGRAPHY, createButtonStyle } from "../styles";
```

## Design Tokens

### Colors (`COLORS`)

- **Primary palette**: `primaryOrange`, `primaryOrangeLight`, `primaryOrangeDark`
- **Neutrals**: `gray100` through `gray900`, `black`, `white`
- **Semantic**: `success`, `warning`, `error`, `info`
- **Backgrounds**: `backgroundPrimary`, `backgroundSecondary`, `backgroundDark`
- **Text**: `textPrimary`, `textSecondary`, `textMuted`, `textInverse`
- **Game-specific**: `tileCorrect`, `tilePartial`, `tileIncorrect`, `tileDefault`

### Typography (`TYPOGRAPHY`)

- **Font families**: `fontPrimary` (PoetsenOne), `fontSecondary` (Poppins)
- **Font sizes**: Responsive scale from `xs` to `4xl`
- **Line heights**: `tight`, `snug`, `normal`, `relaxed`, `loose`
- **Letter spacing**: `tight`, `normal`, `wide`

### Spacing (`SPACING`)

- Responsive spacing scale: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`

### Sizing (`SIZING`)

- **Button**: `height`, `minWidth`
- **Input**: `height`, `minHeight`
- **Tile**: `size`, `border`
- **Icon**: `xs`, `sm`, `md`, `lg`, `xl`

### Border Radius (`BORDER_RADIUS`)

- Scale from `none` to `full` with responsive values

### Shadows (`SHADOWS`)

- Elevation levels: `sm`, `md`, `lg`, `xl`

## Utility Functions

### `createShadow(elevation, shadowOpacity, shadowRadius, shadowColor)`

Creates consistent shadow styles with customizable parameters.

### `createButtonStyle(backgroundColor, textColor, variant)`

Generates button styles with three variants: `solid`, `outline`, `ghost`.

### `createResponsivePadding(basePadding)`

Creates responsive padding that adapts to device size.

## Component Styles

All component styles are organized by category:

- **Layout**: Container, positioning, and layout-related styles
- **Buttons**: All button-related styling
- **Text**: Typography and text-related styles
- **Modals**: Modal dialogs and overlay styles
- **Game**: Game-specific UI elements
- **Forms**: Input fields and form elements
- **Animations**: Animation and special effects

## Benefits

1. **Modularity**: Easy to find and modify specific styles
2. **Reusability**: Design tokens can be used across components
3. **Consistency**: Centralized design system ensures visual consistency
4. **Scalability**: Easy to add new tokens and utilities
5. **Developer Experience**: Better IntelliSense and type safety
6. **Maintainability**: Smaller, focused files are easier to maintain
7. **Backward Compatibility**: Existing code continues to work unchanged

## Migration Guide

### For Existing Code

No changes required! All existing imports continue to work.

### For New Code

1. Use specific imports for better tree-shaking
2. Prefer design tokens over hardcoded values
3. Use utility functions for consistent styling
4. Import only what you need for better performance

## Testing

The modular structure maintains 100% backward compatibility:

- ✅ 520/520 React Native tests passing
- ✅ 738/738 total tests passing
- ✅ All existing components work unchanged
