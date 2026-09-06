#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
# Read-only snapshot. Run in init's mount namespace to observe real runtime mounts.
MODDIR=${0%/*}
. "$MODDIR/common.sh"
[ "$(id -u)" = 0 ] || exit 77
[ -x "$BB" ] || exit 78
if [ "${1:-}" != --inside ]; then
  exec "$BB" timeout 15 "$BB" nsenter -t 1 -m sh "$0" --inside
fi
emit() { printf '%s\t' "$1"; printf '%s' "$2" | "$BB" base64 | "$BB" tr -d '\n'; printf '\n'; }
prop() { emit "$1" "$(getprop "$2")"; }
flag() { key=$1; shift; if "$@"; then emit "$key" 1; else emit "$key" 0; fi; }
emit schema 1
emit collected_at "$(date '+%Y-%m-%d %H:%M:%S %z')"
emit module_version "$(sed -n 's/^version=//p' "$MODDIR/module.prop")"
prop model ro.product.model
prop build ro.build.display.id
prop ota ro.build.version.ota
prop android ro.build.version.release
prop sdk ro.build.version.sdk
prop soc ro.soc.model
emit kernel "$(uname -r)"
emit selinux "$(getenforce 2>/dev/null)"
emit uptime "$(cut -d. -f1 /proc/uptime)"
prop abi32 ro.product.cpu.abilist32
prop abi64 ro.product.cpu.abilist64
prop app32 ro.sys.oplus_support_app32_version
prop service init.svc.zygote_tango
prop boot_complete sys.boot_completed
emit status "$(cat "$DATA/status" 2>/dev/null)"
flag disabled test -f "$MODDIR/disable"
flag removal test -f "$MODDIR/remove"
flag kernel_interface test -c /dev/tango32
flag build_match guard
flag apex_match runtime_guard
emit network_hash "$network_hash"
flag current_boot test "$(cat "$STATE/boot-id" 2>/dev/null)" = "$(cat /proc/sys/kernel/random/boot_id)"
flag image_mounted grep -Fq " $IMAGE " /proc/self/mountinfo
flag system_overlay grep -q ' /system/lib .* - overlay ' /proc/self/mountinfo
flag binfmt grep -q '^enabled' /proc/sys/fs/binfmt_misc/tango_translator
flag translator test -x /system_ext/bin/tango_translator
probe=$("$BB" timeout 4 "$MODDIR/zygote_probe" 2>&1)
emit probe_code "$?"
emit probe "$probe"
emit complete 1
