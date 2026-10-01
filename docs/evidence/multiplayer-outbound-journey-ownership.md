# Multiplayer outbound journey ownership

An action must remain bound to its originating account through synchronous state
notifications, local projections, recovery adapters and selection effects. A
replacement journey owns its own pending delivery and expiry handle. Cancelling
or replacing a journey before transport starts must prevent the old command from
reaching the host/provider, not merely ignore its eventual reply.

## Evidence and correction

Eight initial public-session reproductions failed: account replacement during
begin/reset, send/error reset, pending publication, guess/hint/skip projection,
selection analytics and searching notification all allowed old side effects to
reach the host or provider. Four further reproductions failed after the first
correction: navigation and rematch replaced the new delivery, safety dispatched
an old rival action, and start retry dereferenced a cleared private receipt and
threw. All twelve failures were observed through public session commands/state.
A further failing recovery-adapter case showed that an invalidated search could
leave the replacement account marked searching even without a provider call;
ownership is now checked before publishing that obsolete search state too.

RaceSession now captures the action lifetime across these hand-offs and stops
continuation when ownership changes. Entry reads and reset paths also retain their
account ownership. Recovery cleanup preserves a newer adapter-installed revision.
RacePlay checks exact delivery object identity after pending-state notifications,
before creating its expiry timer or posting to the host. An invalidated send
cannot leak an old command or overwrite the replacement expiry handle.

Pending is reserved before observable local projections and command preparation.
This prevents a same-account observer from submitting a provisional successor
before the first receipt, while existing successor typing and reply reconciliation
remain supported. Additional regression cases protect that reservation, private
delivery disposal/replacement, and recovery-adapter account replacement. These
additional cases were added after correction; they are not claimed as independent
pre-fix reproductions.

## Verification

All 409 client race tests passed before the full verification gate. The injected
browser verifier renders the real RaceTo10Game at 1280x900 and 390x844. A host
selection-analytics callback synchronously replaces the account using React
flushSync. The old start must never reach the host, the new account's failed
category read remains retryable, and the new account can start an untouched game
normally. Captured commands include the account observed at dispatch. Browser
errors are checked and screenshots retained under artifacts/race-dispatch.

The fresh task manifest declares full backend emulator/core/client verification,
types, lint, seven isolated target builds and dependency evidence, Firebase
routing, security/scalability/size/documentation gates and injected browser
verification. The normal completion ledger requires every declared gate and an
unchanged source digest before updating the local progress dashboard.

No UI text or locale files were changed. This verification does not upload,
activate or deploy. Jest activation is permitted; game publication/review/listing
changes remain held. Firebase Functions deployment is authorized separately.
The wider multiplayer reliability audit remains active, including remaining
adapter/persistence lifetime and clock-recovery checks.
