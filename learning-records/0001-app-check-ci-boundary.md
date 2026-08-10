# App Check CI boundary

- Production browsers use reCAPTCHA Enterprise.
- Authorized automated browsers use a separately registered debug token.
- The token is injected before page scripts and is never part of the build.
- A leaked token must be revoked immediately.
