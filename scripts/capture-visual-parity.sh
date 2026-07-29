#!/usr/bin/env bash
set -euo pipefail

runtime_dir="/tmp/riddle-agent-runtime"
output_dir="docs/visual-parity/current"
url="http://127.0.0.1:4173/riddle-quest/?harness=jest"

mkdir -p "$runtime_dir" "$output_dir"
chmod 700 "$runtime_dir"

browser() {
  XDG_RUNTIME_DIR="$runtime_dir" agent-browser "$@"
}

click_button() {
  local label="$1"
  browser eval "(() => {
    const expected = \"$label\".toLocaleLowerCase();
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => {
      const name = (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLocaleLowerCase();
      return candidate.getClientRects().length > 0 && !candidate.closest('[inert]') && name.replace(/\s*›$/, '') === expected;
    });
    if (!button) throw new Error('Visible button not found');
    button.click();
    return true;
  })()"
}

browser open "$url"
browser set viewport 540 1170
browser eval "localStorage.clear()"
browser reload
browser wait --load networkidle
browser wait 1500
browser screenshot "$output_dir/01-onboarding.png"
click_button "Let's Play"
browser wait 250
browser screenshot "$output_dir/02-instructions.png"
click_button "Got It!"
browser wait 250
browser screenshot "$output_dir/03-guest-notice.png"
click_button "OK"
browser wait 500
browser screenshot "$output_dir/04-game-tooltip.png"
for _ in 1 2 3 4; do
  click_button "Got it"
  browser wait 150
done
browser wait 500
browser screenshot "$output_dir/05-game.png"
browser get box ".riddle-surface"
browser get box ".keyboard"
browser get box ".game-input-actions"
browser get box ".game-bottom-navigation"
click_button "Settings"
browser wait 300
browser screenshot "$output_dir/06-settings.png"
click_button "Close"
click_button "Profile"
browser wait 600
browser screenshot "$output_dir/07-profile-tooltip.png"
for _ in 1 2 3 4 5 6 7 8; do
  click_button "Got it"
  browser wait 100
done
browser screenshot "$output_dir/08-profile.png"
click_button "Achievements"
browser wait 250
browser screenshot "$output_dir/09-achievements.png"
click_button "Close"
click_button "Profile"
click_button "Statistics"
browser wait 250
browser screenshot "$output_dir/10-statistics.png"
click_button "Close"
click_button "Profile"
click_button "Ranks"
browser wait 250
browser screenshot "$output_dir/11-ranks.png"
click_button "Close"
click_button "Profile"
click_button "Leaderboard"
browser wait 500
browser screenshot "$output_dir/12-leaderboard.png"
click_button "Close"
click_button "Profile"
click_button "Your Treasure Chest"
browser wait 250
browser screenshot "$output_dir/13-treasure.png"
click_button "Close"
click_button "Settings"
click_button "Help"
browser wait 250
browser screenshot "$output_dir/14-help.png"
click_button "Close"
click_button "Settings"
click_button "Credits"
browser wait 250
browser screenshot "$output_dir/15-credits.png"
click_button "Close"
click_button "Settings"
click_button "About"
browser wait 250
browser screenshot "$output_dir/16-about.png"
click_button "Close"
click_button "Settings"
click_button "Buy coins"
browser wait 500
browser screenshot "$output_dir/17-shop.png"
click_button "Close"
click_button "Logo"
browser wait 250
browser screenshot "$output_dir/18-game-mode.png"
click_button "Close"
click_button "Hint"
browser wait 250
browser screenshot "$output_dir/19-hint.png"
click_button "Close"
click_button "Next"
browser wait 250
browser screenshot "$output_dir/20-skip.png"
click_button "Close"
click_button "Profile"
click_button "Edit"
browser wait 250
browser screenshot "$output_dir/21-username.png"
browser snapshot
browser errors
browser console
browser close
