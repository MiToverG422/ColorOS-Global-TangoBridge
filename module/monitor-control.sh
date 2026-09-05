#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
MODDIR=${0%/*}
. "$MODDIR/common.sh"
[ "$(id -u)" = 0 ] && [ -x "$BB" ] || exit 77
status() {
  enabled=0; [ ! -f "$DATA/monitor.enabled" ] || enabled=1
  # Read the atomically replaced cache once. Capture clocks afterwards so a
  # concurrent sample cannot appear newer than this status request.
  cache=$(cat "$DATA/monitor.sample" 2>/dev/null)
  boot=$(cat /proc/sys/kernel/random/boot_id)
  read -r uptime unused < /proc/uptime
  uptime=${uptime%%.*}
  printf 'CONTROL\t2\nENABLED\t%s\nNOW\t%s\nUPTIME\t%s\n' "$enabled" "$(date +%s)" "$uptime"
  if [ "$(printf '%s\n' "$cache" | head -n 2)" = "$(printf '%s\nCACHE\t2' "$boot")" ]; then
    printf '%s\n' "$cache" | tail -n +3
  else
    printf 'SAMPLED\t0\nSAMPLE_UPTIME\t0\nAVAILABLE\t0\n'
  fi
}
case "${1:-status}" in
  enable|restore)
    if [ "$1" = restore ] && [ ! -f "$DATA/monitor.enabled" ]; then exit 0; fi
    guard && [ ! -f "$MODDIR/disable" ] && [ ! -f "$MODDIR/remove" ] || exit 1
    mkdir -p "$DATA"
    chmod 700 "$DATA"
    touch "$DATA/monitor.enabled"
    "$BB" nohup "$BB" flock -n "$DATA/monitor.lock" sh "$MODDIR/monitor-daemon.sh" </dev/null >/dev/null 2>&1 &
    ;;
  disable) rm -f "$DATA/monitor.enabled" ;;
  status) ;;
  *) exit 64 ;;
esac
status
