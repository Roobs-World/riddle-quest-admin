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
      return candidate.getClientRects().length > 0 && !candidate.closest('[inert]') && name === expected;
    });
    if (!button) throw new Error('Visible button not found');
    button.click();
    return true;
  })()"
}

click_if_present() {
  local label="$1"
  browser eval "(() => {
    const expected = \"$label\".toLocaleLowerCase();
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => {
      const name = (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLocaleLowerCase();
      return candidate.getClientRects().length > 0 && !candidate.closest('[inert]') && name === expected;
    });
    button?.click();
    return Boolean(button);
  })()"
}

enter_word() {
  local word="$1"
  local index
  for ((index = 0; index < ${#word}; index += 1)); do
    click_button "${word:index:1}"
  done
}

browser open "$url"
browser set viewport 540 1170
browser eval "localStorage.clear()"
browser reload
browser wait --load networkidle
browser wait 1000
click_button "Let's Play"
click_button "Got It!"
click_button "OK"
browser wait 350
for _ in 1 2 3 4; do
  click_button "Got it"
done

enter_word "PIANO"
click_button "SUBMIT"
browser wait 600
click_if_present "Got it"
browser wait 300
browser screenshot "$output_dir/22-victory.png"
click_if_present "Next"
browser wait 200
click_if_present "Next"
browser wait 200
click_if_present "Next"
browser wait 200
click_if_present "Next Level"
browser wait 600
click_if_present "Got it"
browser wait 200

for attempt in 1 2 3 4 5; do
  enter_word "QQQQQ"
  click_button "SUBMIT"
  browser wait 250
  if [[ "$attempt" == "1" ]]; then
    click_if_present "Got it"
  fi
done
browser wait 300
browser screenshot "$output_dir/23-continue.png"
click_button "Use 100 Coins to Continue"
browser wait 500
browser screenshot "$output_dir/24-extra-guess.png"
enter_word "QQQQQ"
click_button "SUBMIT"
browser wait 500
browser screenshot "$output_dir/25-loss.png"
browser snapshot
browser errors
browser console
browser close
