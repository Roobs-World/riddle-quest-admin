# Modern Modal Management System

## Overview

This modern modal management system provides a clean, reusable, and type-safe approach to handling modals in the Qwordly game. It replaces the previous approach of managing modal state in individual components with a centralized, context-based system.

## Key Features

- **Centralized State Management**: All modal state is managed in a single context
- **Type Safety**: Full TypeScript support with proper typing for modal data
- **Declarative API**: Simple `showModal()` and `closeModal()` methods
- **Reusable Across Components**: Can be used in any component that needs modals
- **Priority System**: Modals can be ordered by priority
- **Persistent Modals**: Some modals can be marked as persistent (won't close on backdrop press)
- **Memory Efficient**: Modals are only rendered when open

## Before vs After

### Before (Old System)

```typescript
// Massive state object with 10+ modal states
const [overlayState, setOverlayState] = useState<GameScreenState>({
  isInstructionsVisible: false,
  isFullProfileDetailsOverlayVisible: false,
  isCoinShopModalVisible: false,
  isWatchAdModalVisible: false,
  isOutOfAttemptsModalVisible: false,
  // ... 10+ more states
});

// Individual handlers for each modal
const handleCloseInstructions = () => {
  setOverlayState((prev) => ({
    ...prev,
    isInstructionsVisible: false,
  }));
};

// Massive props object passed to GameOverlays
<GameOverlays
  isInstructionsVisible={overlayState.isInstructionsVisible}
  onCloseInstructions={handleCloseInstructions}
  // ... 50+ more props
/>;
```

### After (New System)

```typescript
// Simple modal hook
const modal = useModal();

// Declarative modal actions
const handleShowInstructions = () => {
  modal.showInstructionsModal();
};

const handleShowSettings = () => {
  modal.showSettingsModal({
    isSoundEnabled,
    isHapticsEnabled,
    onToggleSound: toggleSoundEnabled,
    onToggleHaptics: toggleHapticsEnabled,
    onPressLogout: logout,
    onPressHelp: () => modal.showInstructionsModal(),
    onPressCredits: () => navigation.navigate("Credits"),
  });
};

// Single modal provider component
<ModalProvider />;
```

## System Architecture

### Core Components

1. **ModalTypes.ts** - Type definitions for the modal system
2. **ModalContext.tsx** - Context provider for modal state management
3. **useModal.ts** - Custom hook for interacting with modals
4. **ModalProvider.tsx** - Component that renders active modals
5. **ModalRegistry.tsx** - Registry system for mapping modal types to components

### File Structure

```
src/
├── types/
│   └── ModalTypes.ts          # Type definitions
├── contexts/
│   └── ModalContext.tsx       # Context provider
├── hooks/
│   └── useModal.ts            # Custom hook
└── components/
    └── modals/
        ├── ModalProvider.tsx  # Modal renderer
        ├── ModalRegistry.tsx  # Modal registry
        └── README.md          # This file
```

## Usage Guide

### 1. Setup the Modal Provider

Wrap your app with the `ModalProvider`:

```typescript
import { ModalProvider } from "./contexts/ModalContext";

function App() {
  return (
    <ModalProvider>
      {/* Your app content */}
      <YourMainComponent />

      {/* Place the modal provider at the root level */}
      <ModalProvider />
    </ModalProvider>
  );
}
```

### 2. Use the Modal Hook

In any component that needs to show modals:

```typescript
import { useModal } from "../hooks/useModal";

function MyComponent() {
  const modal = useModal();

  // Show a modal
  const handleShowSettings = () => {
    modal.showSettingsModal({
      isSoundEnabled: true,
      isHapticsEnabled: true,
      onToggleSound: (enabled) => console.log("Sound:", enabled),
      onToggleHaptics: (enabled) => console.log("Haptics:", enabled),
      onPressLogout: () => console.log("Logout"),
      onPressHelp: () => modal.showInstructionsModal(),
      onPressCredits: () => console.log("Credits"),
    });
  };

  // Close a modal
  const handleCloseSettings = () => {
    modal.closeModalByType("settings");
  };

  // Check if modal is open
  const isSettingsOpen = modal.isModalOpen("settings");

  return (
    <View>
      <Button title="Settings" onPress={handleShowSettings} />
      {isSettingsOpen && <Text>Settings is open!</Text>}
    </View>
  );
}
```

### 3. Available Modal Methods

#### Convenience Methods (Type-Safe)

```typescript
// Game modals
modal.showVictoryModal({
  attempts: 3,
  coinsEarned: 100,
  onNext: () => {},
  onHome: () => {},
});
modal.showLossModal({
  correctAnswer: "HELLO",
  onNext: () => {},
  onHome: () => {},
});
modal.showOutOfAttemptsModal({
  userCoins: 50,
  continueCost: 25,
  onWatchAd: () => {},
  onSpendCoins: () => {},
});

// Settings modals
modal.showSettingsModal({ isSoundEnabled: true /* ... */ });
modal.showFullProfileDetailsModal({ playerData: userData });

// Help modals
modal.showHintModal({ hintCost: 10, userCoins: 50, onShowHint: () => {} });
modal.showWelcomeModal();
modal.showInstructionsModal();

// Shop modals
modal.showCoinShopModal({ onPurchaseProduct: (id) => {} });
```

#### Core Methods

```typescript
// Generic modal opening
modal.openModal("customModal", { customData: "value" });

// Close specific modal
modal.closeModal(modalId);
modal.closeModalByType("settings");

// Close all modals
modal.closeAllModals();

// Check modal state
modal.isModalOpen("settings");
modal.getModalData("settings");

// Update modal data
modal.updateModalData(modalId, { newData: "value" });
```

### 4. Modal Options

When opening modals, you can pass options:

```typescript
modal.showSettingsModal(data, {
  priority: 10, // Higher priority shows on top
  persistent: true, // Won't close on backdrop press
  replace: true, // Closes other modals of same type first
});
```

## Benefits

### 1. **Reduced Code Complexity**

- **Before**: 848 lines in GameScreen.tsx with complex state management
- **After**: ~500 lines with simplified state and declarative modal calls

### 2. **Type Safety**

- Full TypeScript support with proper typing for modal data
- Compile-time errors for incorrect modal props
- IntelliSense support for all modal methods

### 3. **Better Performance**

- Modals are only rendered when open
- Context optimizations prevent unnecessary re-renders
- Memory efficient modal management

### 4. **Improved Developer Experience**

- Simple, intuitive API
- Easy to add new modals
- Consistent modal behavior across the app
- Better debugging with centralized state

### 5. **Maintainability**

- Single source of truth for modal state
- Easy to modify modal behavior globally
- Clear separation of concerns
- Reusable across different screens

## Adding New Modals

### 1. Define the Modal Type

Add to `GameModalTypes` in `ModalTypes.ts`:

```typescript
export interface GameModalTypes {
  // ... existing modals

  myNewModal: {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  };
}
```

### 2. Create the Modal Component

```typescript
// src/components/modals/MyNewModal.tsx
import { BaseModalProps } from "../../types/ModalTypes";

interface MyNewModalProps extends BaseModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const MyNewModal: React.FC<MyNewModalProps> = ({
  isVisible,
  onClose,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  // Modal implementation
};
```

### 3. Register the Modal

Add to `ModalProvider.tsx`:

```typescript
case 'myNewModal':
  return (
    <MyNewModal
      {...commonProps}
      title={modalData.title}
      message={modalData.message}
      onConfirm={modalData.onConfirm}
      onCancel={modalData.onCancel}
    />
  );
```

### 4. Add Convenience Method

Add to `useModal.ts`:

```typescript
const showMyNewModal = useCallback(
  (data: ModalDataType<"myNewModal">, options?: ModalOptions): string => {
    return openGameModal("myNewModal", data, options);
  },
  [openGameModal]
);
```

### 5. Use the New Modal

```typescript
modal.showMyNewModal({
  title: "Confirm Action",
  message: "Are you sure?",
  onConfirm: () => console.log("Confirmed"),
  onCancel: () => console.log("Cancelled"),
});
```

## Migration Guide

To migrate from the old system to the new system:

1. **Wrap your app** with `ModalProvider`
2. **Replace state management** with `useModal` hook
3. **Replace individual handlers** with modal methods
4. **Update modal renders** to use `<ModalProvider />`
5. **Remove old overlay components** and state objects

## Best Practices

1. **Use type-safe methods** when possible (e.g., `showSettingsModal` vs `openModal`)
2. **Close modals explicitly** when needed for better UX
3. **Use priority system** for modal ordering
4. **Avoid nested modal calls** - close existing modals before opening new ones
5. **Handle modal data updates** using `updateModalData` for dynamic content

This system provides a solid foundation for modal management that scales well with the application's growth while maintaining clean, readable code.
