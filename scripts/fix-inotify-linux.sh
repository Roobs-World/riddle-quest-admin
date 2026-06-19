#!/usr/bin/env bash
set -euo pipefail

WATCHES="${INOTIFY_MAX_USER_WATCHES:-524288}"
INSTANCES="${INOTIFY_MAX_USER_INSTANCES:-1024}"
SYSCTL_FILE="/etc/sysctl.d/99-qwordly-inotify.conf"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "inotify limits only apply on Linux."
  exit 0
fi

echo "Current inotify limits:"
echo "  fs.inotify.max_user_watches=$(cat /proc/sys/fs/inotify/max_user_watches)"
echo "  fs.inotify.max_user_instances=$(cat /proc/sys/fs/inotify/max_user_instances)"
echo

echo "Top inotify users:"
(find /proc/*/fd -lname "anon_inode:inotify" -printf "%h\n" 2>/dev/null || true) \
  | sed -E "s#/proc/([0-9]+)/fd#\1#" \
  | sort \
  | uniq -c \
  | sort -nr \
  | head -20 \
  | while read -r count pid; do
      if [[ -r "/proc/$pid/cmdline" ]]; then
        command="$(tr '\0' ' ' < "/proc/$pid/cmdline" | cut -c1-120)"
        printf "  %5s  pid=%-8s %s\n" "$count" "$pid" "$command"
      fi
    done
echo

config="fs.inotify.max_user_watches=$WATCHES
fs.inotify.max_user_instances=$INSTANCES
"

if [[ "${1:-}" == "--check" ]]; then
  echo "Recommended persistent config:"
  printf "%s" "$config"
  exit 0
fi

echo "Writing persistent inotify config to $SYSCTL_FILE"
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  printf "%s" "$config" > "$SYSCTL_FILE"
  sysctl -p "$SYSCTL_FILE"
else
  printf "%s" "$config" | sudo tee "$SYSCTL_FILE" >/dev/null
  sudo sysctl -p "$SYSCTL_FILE"
fi

echo
echo "Updated inotify limits:"
echo "  fs.inotify.max_user_watches=$(cat /proc/sys/fs/inotify/max_user_watches)"
echo "  fs.inotify.max_user_instances=$(cat /proc/sys/fs/inotify/max_user_instances)"
