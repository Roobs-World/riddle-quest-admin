# Missing Localizations

All supported locale override tables currently provide explicit, non-empty values for every string in `EN_APP_STRINGS`.

Supported languages:

- English (`en`)
- Spanish (`es`)
- Portuguese (`pt`)
- French (`fr`)
- German (`de`)
- Japanese (`ja`)
- Korean (`ko`)
- Chinese (`zh`)
- Hindi (`hi`)
- Russian (`ru`)
- Turkish (`tr`)
- Arabic (`ar`)
- Indonesian (`id`)
- Italian (`it`)
- Dutch (`nl`)
- Polish (`pl`)
- Vietnamese (`vi`)

The regression test in `src/constants/__tests__/AppStrings.i18n.test.ts` compares every non-English locale override against the English string tree so new keys cannot silently fall back to English.

Repo-wide localization verification runs through `pnpm run i18n:verify`, which chains catalog generation, strict i18n quality, the hardcoded-text scanner, and the legacy i18n usage check.
