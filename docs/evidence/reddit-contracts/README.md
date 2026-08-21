# Reddit hosted contract evidence

Store only sanitized JSON produced by:

```sh
pnpm --filter @qwordly/reddit-app capture:contract <type> -
```

Required types are `auth`, `payment`, `refund`, `post-entry`, `realtime`, and
`notification`. Never store raw payloads, Reddit IDs, credentials, cookies,
signatures, tokens, usernames, avatar URLs, or payment records here.

Validate the complete evidence set with:

```sh
pnpm --filter @qwordly/reddit-app validate:contracts
```

The release gate will remain closed until all required real hosted fixtures pass.
