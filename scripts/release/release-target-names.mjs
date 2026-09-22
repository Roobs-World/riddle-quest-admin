const dashboardNames = new Map([
  ["crazygames", "CrazyGames"], ["coolmath", "Coolmath Games"], ["armor", "Armor Games"],
  ["htmlgames", "HTMLGames.com"], ["lagged", "Lagged"], ["telegram", "Telegram"],
  ["microsoft-pwa", "Microsoft Store PWA"], ["y8", "Y8"], ["amazon", "Amazon Appstore Web App"],
  ["jiogames", "JioGames HTML5"], ["gamepush", "GamePush Distribution"], ["softgames", "SOFTGAMES"],
  ["wgplayground", "WGPlayground"], ["huawei", "Huawei Quick Game"], ["gameflare", "GameFlare Distribution"],
  ["world", "World App Mini Apps"], ["farcaster", "Farcaster Mini Apps"], ["pi", "Pi Apps Platform"],
  ["minipay", "MiniPay Mini Apps"], ["zoom", "Zoom App Marketplace"], ["pwa-directory", "PWA Directory"],
  ["miro", "Miro Marketplace"], ["greenhouse", "Greenhouse Games"], ["ozogames", "OzoGames"],
  ["slowden", "SlowDen"], ["noadsgames", "NoAdsGames"], ["gamesnacks", "Google GameSnacks"],
]);

export const expectedName = (plan) => dashboardNames.get(plan.target) ?? plan.title.replace(/ (Basic Launch|pitch|review)$/u, "");
