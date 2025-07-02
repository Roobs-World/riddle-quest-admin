#!/bin/bash

# Script to set environment variables for Firebase Functions
# Run this script from the firebase-functions directory

echo "Setting environment variables for Firebase Functions..."

# OpenAI API Key (required for riddle generation)
echo "Setting OPENAI_API_KEY..."
echo "YnDnl1dSucAApjYEN019-6hGt2ufiedaq4HsP-h7" | firebase functions:secrets:set OPENAI_API_KEY

# Apple Shared Secret (required for IAP validation)
echo "Setting APPLE_SHARED_SECRET..."
echo "your_apple_shared_secret_here" | firebase functions:secrets:set APPLE_SHARED_SECRET

# AppLovin SDK Key (required for ad callbacks)
echo "Setting APPLOVIN_SDK_KEY..."
echo "l0DW3tQICL3wzDHvHp2_94_T9l9RTheo_ETqTv9wek0c2BLUG17QClOTHhLNUB_3SusS4e8PEfmokc9ymTO0px" | firebase functions:secrets:set APPLOVIN_SDK_KEY

# Google Service Account (required for IAP validation)
echo "Setting GOOGLE_SERVICE_ACCOUNT..."
# This should be the full JSON service account key as a string
echo '{"type":"service_account","project_id":"qwordly-6ba44","private_key_id":"your_private_key_id","private_key":"-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n","client_email":"your_service_account@qwordly-6ba44.iam.gserviceaccount.com","client_id":"your_client_id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/your_service_account%40qwordly-6ba44.iam.gserviceaccount.com"}' | firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT

echo "Environment variables set successfully!"
echo "Note: You may need to update the APPLE_SHARED_SECRET and GOOGLE_SERVICE_ACCOUNT with actual values." 