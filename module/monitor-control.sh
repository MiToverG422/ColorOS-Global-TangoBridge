#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
MODDIR=${0%/*}
. "$MODDIR/common.sh"
[ "$(id -u)" = 0 ] && [ -x "$BB" ] || exit 77
status() {
  enabled=0; [ ! -f "$DATA/monitor.enabled" ] || enabled=1
  printf 'CONTROL\t1\nENABLED\t%s\nNOW\t%s\n' "$enabled" "$(date +%s)"
  boot=$(cat /proc/sys/kernel/random/boot_id)
  if [ "$(head -n 1 "$DATA/monitor.sample" 2>/dev/null)" = "$boot" ]; then
    tail -n +2 "$DATA/monitor.sample"
  else
    printf 'SAMPLED\t0\nAVAILABLE\t0\n'
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
