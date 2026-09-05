#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
# Started under flock by monitor-control.sh. No history or wake lock.
MODDIR=${0%/*}
. "$MODDIR/common.sh"
umask 077
enabled() {
  [ -f "$DATA/monitor.enabled" ] && [ -d "$MODDIR" ] &&
  [ ! -f "$MODDIR/disable" ] && [ ! -f "$MODDIR/remove" ]
}
boot=$(cat /proc/sys/kernel/random/boot_id)
while enabled; do
  sample=$(sh "$MODDIR/monitor.sh")
  result=$?
  {
    printf '%s\nSAMPLED\t%s\n' "$boot" "$(date +%s)"
    if [ "$result" = 0 ]; then
      printf 'AVAILABLE\t1\n%s\n' "$sample"
    else
      printf 'AVAILABLE\t0\n'
    fi
  } > "$DATA/monitor.sample.tmp"
  enabled || break
  mv -f "$DATA/monitor.sample.tmp" "$DATA/monitor.sample"
  sleep 10
done
rm -f "$DATA/monitor.sample.tmp"
