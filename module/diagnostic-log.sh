#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
BB=/data/adb/ksu/bin/busybox
[ "$(id -u)" = 0 ] && [ -x "$BB" ] || exit 77
case "${1:-startup}" in
  startup) file=startup.log;;
  prepare) file=network-prepare.log;;
  probe) file=network-probe.log;;
  *) exit 64;;
esac
file=/data/adb/tango32_findx9u/$file
[ -f "$file" ] || exit 0
"$BB" timeout 5 "$BB" tail -c 65536 "$file" | "$BB" tail -n 120
