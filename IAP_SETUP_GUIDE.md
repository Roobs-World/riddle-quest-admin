# 💰 In-App Purchase Setup Guide - Qwordly

## 🎯 **Quick Overview**

Your app is now configured to sell 4 coin packs:

- **100 Coins** - $1.99 (`com.qwordly.coins100`)
- **250 Coins** - $4.99 (`com.qwordly.coins250`)
- **500 Coins** - $9.99 (`com.qwordly.coins500`)
- **1000 Coins** - $19.99 (`com.qwordly.coins1000`)

## 📱 **Platform Setup Required**

### **Step 1: iOS - App Store Connect**

1. **Login**: https://appstoreconnect.apple.com
2. **Navigate**: Your App → Features → In-App Purchases
3. **Create 4 Products**:

| Product ID              | Name       | Type       | Price  |
| ----------------------- | ---------- | ---------- | ------ |
| `com.qwordly.coins100`  | 100 Coins  | Consumable | $1.99  |
| `com.qwordly.coins250`  | 250 Coins  | Consumable | $4.99  |
| `com.qwordly.coins500`  | 500 Coins  | Consumable | $9.99  |
| `com.qwordly.coins1000` | 1000 Coins | Consumable | $19.99 |

**Important**:

- ✅ Set status to "Ready to Submit"
- ✅ Add product descriptions
- ✅ Upload review screenshot

### **Step 2: Android - Google Play Console**

1. **Login**: https://play.google.com/console
2. **Navigate**: Your App → Products → In-app products
3. **Create same 4 products** with identical Product IDs and pricing

## 🧪 **Testing Setup**

### **iOS Testing**

1. **Add Test Users**: App Store Connect → Users and Access → Sandbox Testers
2. **Test on Device**: Sign out of App Store, app will prompt for sandbox account

### **Android Testing**

1. **Add Test Accounts**: Google Play Console → Setup → License testing
2. **Upload APK**: Internal testing track required for IAP testing

## 🔧 **Code Integration** ✅

Your code is already configured! The updates include:

**✅ Updated Product IDs** (`src/services/IapService.ts`):

```typescript
const coinProductIds = [
  "com.qwordly.coins100",
  "com.qwordly.coins250",
  "com.qwordly.coins500",
  "com.qwordly.coins1000",
];
```

**✅ Updated Coin Shop Modal** (`src/components/shop/CoinShopModal.tsx`):

- Static coin packs with proper product IDs
- Dynamic products from app stores
- Proper error handling and loading states

## 🚀 **Testing Your Setup**

### **1. Test Product Loading**

```bash
# Run your app in development
npx expo run:ios
# or
npx expo run:android

# Check console for:
# "Fetched products: [...]"
```

### **2. Test Purchase Flow**

- Products should appear in coin shop
- Tap purchase buttons
- Complete test purchases
- Verify coins are awarded

## 🔍 **Troubleshooting**

### **No Products Loading**

```typescript
// Common issues:
1. Product IDs don't match exactly ❌
2. Products not "Ready to Submit" ❌
3. App not signed with distribution certificate ❌
4. Bundle ID mismatch ❌
```

### **Purchase Validation Fails**

- Check Firebase Functions logs
- Verify `validatePurchase` function is deployed
- Ensure proper receipt validation

### **Development vs Production**

- **Development**: Use sandbox/test accounts
- **Production**: Real money transactions

## 📊 **Expected User Flow**

1. **User opens coin shop** → Products load from app stores
2. **User taps purchase** → Native payment UI appears
3. **User completes payment** → Receipt sent to your server
4. **Server validates** → Coins added to user account
5. **Transaction finished** → User sees coin balance update

## 🛡️ **Security Notes**

- ✅ **Server-side validation**: All purchases verified via Firebase Functions
- ✅ **Receipt verification**: Uses official App Store/Google Play APIs
- ✅ **Atomic transactions**: Coins only awarded after successful validation
- ✅ **Duplicate protection**: Transaction IDs tracked to prevent replay attacks

## 🎉 **Next Steps**

1. **Create products** in App Store Connect and Google Play Console
2. **Test thoroughly** with sandbox accounts
3. **Deploy to TestFlight/Internal Testing** for final verification
4. **Submit for review** with IAP functionality working

---

Your app is now ready for monetization! 🚀
