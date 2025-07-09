#!/bin/bash

# Script to set environment variables for Firebase Functions
# Run this script from the firebase-functions directory
# 
# IMPORTANT: Before running this script, ensure you have:
# 1. A .env file in the firebase-functions directory with your actual values
# 2. The Firebase CLI installed and logged in
# 3. Set your Firebase project: firebase use your-project-id

echo "Setting environment variables for Firebase Functions..."

# Load environment variables from .env file
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "WARNING: No .env file found. Please create one with your actual values."
    echo "See .env.example for required variables."
    exit 1
fi

# OpenAI API Key (required for riddle generation)
echo "Setting OPENAI_API_KEY..."
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "YOUR_OPENAI_API_KEY_HERE" ]; then
    echo "ERROR: OPENAI_API_KEY not set in .env file"
    exit 1
fi
echo "$OPENAI_API_KEY" | firebase functions:secrets:set OPENAI_API_KEY

# Apple Shared Secret (required for IAP validation)
echo "Setting APPLE_SHARED_SECRET..."
if [ -z "$APPLE_SHARED_SECRET" ] || [ "$APPLE_SHARED_SECRET" = "YOUR_APPLE_SHARED_SECRET" ]; then
    echo "WARNING: APPLE_SHARED_SECRET not set. IAP validation for Apple will not work."
else
    echo "$APPLE_SHARED_SECRET" | firebase functions:secrets:set APPLE_SHARED_SECRET
fi

# AppLovin SDK Key (required for ad callbacks)
echo "Setting APPLOVIN_SDK_KEY..."
if [ -z "$APPLOVIN_SDK_KEY" ] || [ "$APPLOVIN_SDK_KEY" = "YOUR_APPLOVIN_SDK_KEY" ]; then
    echo "WARNING: APPLOVIN_SDK_KEY not set. Ad callbacks will not work."
else
    echo "$APPLOVIN_SDK_KEY" | firebase functions:secrets:set APPLOVIN_SDK_KEY
fi

# Google Service Account (required for IAP validation)
echo "Setting GOOGLE_SERVICE_ACCOUNT..."
if [ -z "$GOOGLE_SERVICE_ACCOUNT" ] || [ "$GOOGLE_SERVICE_ACCOUNT" = "YOUR_GOOGLE_SERVICE_ACCOUNT_JSON" ]; then
    echo "WARNING: GOOGLE_SERVICE_ACCOUNT not set. IAP validation for Google Play will not work."
else
    echo "$GOOGLE_SERVICE_ACCOUNT" | firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT
fi

echo ""
echo "Environment variables set successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy your Firebase Functions: firebase deploy --only functions"
echo "2. Test your functions to ensure they can access the secrets"
echo ""
echo "Note: If you need to update any secrets later, modify your .env file and run this script again." 