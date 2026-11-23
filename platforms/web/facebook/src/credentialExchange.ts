import type {FacebookInstantSdk} from "./fbinstant";
import type {FacebookBackendPort, FacebookIdentityCredentials} from "./backend";

/** Provides exchange facebook credentials behavior. */
export async function exchangeFacebookCredentials(
  sdk: FacebookInstantSdk,
  backend: FacebookBackendPort,
): Promise<FacebookIdentityCredentials> {
  /** Provides {nonce} behavior. */
  const {nonce} = await backend.issueIdentityNonce();
  /** Provides signed behavior. */
  const signed = await sdk.player.getSignedPlayerInfoAsync(nonce);
  /** Provides player id behavior. */
  const playerId = sdk.player.getID();
  if (!playerId || signed.getPlayerID() !== playerId) throw new Error("facebook-signed-player-id-mismatch");
  return backend.exchangeIdentity({signedPlayer: signed.getSignature(), playerId, nonce});
}
