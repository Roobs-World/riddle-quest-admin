import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("responsive screen and modal coverage", () => {
  it.each([
    [
      "LandingScreen",
      "src/screens/LandingScreen.tsx",
      ["LANDING_LOGO_WIDTH", "LANDING_LOGO_HEIGHT", "authContentContainer"],
    ],
    ["GameScreen", "src/screens/game/GameScreen.tsx", ["isTablet", "isLargeTablet", "isDesktop", "gameContainer"]],
  ])("%s keeps responsive layout hooks in place", (_name, relativePath, markers) => {
    const source = read(relativePath);
    for (const marker of markers) {
      expect(source).toContain(marker);
    }
  });

  it.each([
    ["AchievementUnlockFanfareModal", "src/components/modals/game/AchievementUnlockFanfareModal.tsx"],
    ["LevelUpFanfareModal", "src/components/modals/game/LevelUpFanfareModal.tsx"],
    ["LossModal", "src/components/modals/game/LossModal.tsx"],
    ["StreakIncreaseFanfareModal", "src/components/modals/game/StreakIncreaseFanfareModal.tsx"],
    ["VictoryModal", "src/components/modals/game/VictoryModal.tsx"],
    ["AboutLegalModal", "src/components/modals/help/AboutLegalModal.tsx"],
    ["CreditsModal", "src/components/modals/help/CreditsModal.tsx"],
    ["HintModal", "src/components/modals/help/HintModal.tsx"],
    ["InfoModal", "src/components/modals/help/InfoModal.tsx"],
    ["InstructionsModal", "src/components/modals/help/InstructionsModal.tsx"],
    ["SkipModal", "src/components/modals/help/SkipModal.tsx"],
    ["WelcomeBackModal", "src/components/modals/help/WelcomeBackModal.tsx"],
    ["WelcomeModal", "src/components/modals/help/WelcomeModal.tsx"],
    ["AchievementsModal", "src/components/modals/settings/AchievementsModal.tsx"],
    ["DeleteAccountConfirmationModal", "src/components/modals/settings/DeleteAccountConfirmationModal.tsx"],
    ["FullProfileDetailsModal", "src/components/modals/settings/FullProfileDetailsModal.tsx"],
    ["LeaderboardModal", "src/components/modals/settings/LeaderboardModal.tsx"],
    ["SettingsModal", "src/components/modals/settings/SettingsModal.tsx"],
    ["StatsModal", "src/components/modals/settings/StatsModal.tsx"],
    ["UpdateUsernameModal", "src/components/modals/settings/UpdateUsernameModal.tsx"],
    ["UpgradeAccountModal", "src/components/modals/settings/UpgradeAccountModal.tsx"],
    ["CoinPurchaseFanfareModal", "src/components/modals/shop/CoinPurchaseFanfareModal.tsx"],
    ["OfflineBlockingModal", "src/components/modals/system/OfflineBlockingModal.tsx"],
  ])("%s keeps responsive modal constraints in place", (_name, relativePath) => {
    const source = read(relativePath);

    expect(source).toMatch(/SlideInModalContent|DecoratedModalShell/);
    expect(source).toMatch(/MODAL_MAX_HEIGHT|getResponsiveModalHeight|AUTH_CONTENT_MAX_WIDTH/);
  });
});
