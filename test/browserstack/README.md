# BrowserStack iOS matrix

The iOS smoke matrix runs the signed Expo/EAS Release build on BrowserStack
App Automate with WebdriverIO and Appium/XCUITest.

## GitHub Actions

Run the `iOS BrowserStack Matrix` workflow manually. The repository must have
these Actions secrets:

- `EXPO_TOKEN`
- `BROWSERSTACK_USERNAME`
- `BROWSERSTACK_ACCESS_KEY`

The workflow builds the `browserstack` EAS profile, downloads the resulting
IPA, uploads it through the BrowserStack WebdriverIO service, and runs the
landing-screen smoke test on the configured iPhone and iPad devices.

Until EAS has valid non-interactive Apple distribution credentials, supply the
workflow's optional `ipa_url` input with a public signed IPA URL. This skips the
EAS build; `EXPO_TOKEN` is then not required.

## Local run

Set `BROWSERSTACK_APP` to a local IPA path, public IPA URL, BrowserStack custom
ID, or `bs://` app URL. BrowserStack credentials can be set in the environment
or in `.env.browserstack.local`.

```powershell
$env:BROWSERSTACK_APP = "C:\path\to\riddle-quest.ipa"
pnpm run test:ios:browserstack
```

To configure Apple signing, build the IPA, and run BrowserStack end to end:

```powershell
.\scripts\run-ios-browserstack.ps1 -ConfigureCredentials
```

Override the default device matrix with a JSON array:

```powershell
$env:BROWSERSTACK_IOS_DEVICES = '[{"deviceName":"iPhone 15","osVersion":"17"}]'
```
