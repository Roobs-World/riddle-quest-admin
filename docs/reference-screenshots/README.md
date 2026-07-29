# Android parity reference

The `android/` directory is the curated visual reference retained from the former React Native app. It covers:

- onboarding and welcome;
- normal gameplay and layout spacing;
- settings, profile, and username editing;
- coin shop and balance;
- loss, paid continuation, and reward states.

Transient launcher, blank, duplicate, crash, development-overlay, connection, and ad-diagnostic captures were removed. The corresponding 25-state React web acceptance pack is generated in `docs/visual-parity/current/` by:

```bash
bash scripts/capture-visual-parity.sh
bash scripts/capture-outcome-parity.sh
```
