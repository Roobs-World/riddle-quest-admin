import {readFileSync} from "node:fs";
import type {Plugin} from "vite";

/** Provides reddit artifact plugin behavior. */
export function redditArtifactPlugin(): Plugin {
  return {
    name: "riddle-quest-reddit-artifact",
    enforce: "pre",
    /** Provides load behavior. */
    load(id) {
      /** Provides filename behavior. */
      const filename = id.split("?", 1)[0];
      if (!/[\\/]src[\\/]locales[\\/][^\\/]+[\\/]shop\.json$/u.test(filename)) return null;
      /** Provides catalog behavior. */
      const catalog = JSON.parse(readFileSync(filename, "utf8")) as {/** Stores coin shop. */
      /** Stores coin shop. */
      CoinShop?: Record<string, unknown>};
      /** Provides shop behavior. */
      const shop = catalog.CoinShop ?? {};
      return JSON.stringify({CoinShop: Object.fromEntries([
        "COINS_SUFFIX", "LOADING_TEXT", "NO_PACKS_AVAILABLE", "PURCHASE_BUTTON", "TITLE", "YOUR_BALANCE",
      ].flatMap((key) => key in shop ? [[key, shop[key]]] : []))});
    },
  };
}
