export interface JestBackendPort {
  exchangeIdentity(playerSigned: string): Promise<{customToken: string; uid: string}>;
  grantPurchase(purchaseSigned: string, playerId: string, purchaseToken: string): Promise<{
    granted: boolean;
    purchaseToken: string;
    coinsAwarded: number;
    newCoins: number;
    newlyUnlockedAchievementIds?: string[];
  }>;
  verifyReferrals(referralsSigned: string, playerId: string): Promise<{verified: boolean}>;
  syncSubscriptions(subscriptionsSigned: string, playerId: string): Promise<{
    verified: boolean;
    activeSkus: string[];
    blockedSkus?: string[];
  }>;
}

export class JestBackendClient implements JestBackendPort {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Jest backend ${path} failed (${response.status})`);
    return response.json() as Promise<T>;
  }

  exchangeIdentity(playerSigned: string) { return this.post<{customToken: string; uid: string}>("exchangeJestIdentity", {playerSigned}); }
  grantPurchase(purchaseSigned: string, playerId: string, purchaseToken: string) {
    return this.post<{
      granted: boolean;
      purchaseToken: string;
      coinsAwarded: number;
      newCoins: number;
      newlyUnlockedAchievementIds?: string[];
    }>(
      "grantJestPurchase",
      {purchaseSigned, playerId, purchaseToken},
    );
  }
  verifyReferrals(referralsSigned: string, playerId: string) { return this.post<{verified: boolean}>("verifyJestReferrals", {referralsSigned, playerId}); }
  syncSubscriptions(subscriptionsSigned: string, playerId: string) {
    return this.post<{verified: boolean; activeSkus: string[]; blockedSkus?: string[]}>(
      "syncJestSubscriptions",
      {subscriptionsSigned, playerId},
    );
  }
}
