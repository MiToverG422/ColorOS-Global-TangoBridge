#!/system/bin/sh
MODDIR=${1:-${0%/*}}
. "$MODDIR/common.sh"
setprop ctl.stop zygote_tango
if [ -f "$STATE/boot-id" ] && [ "$(cat "$STATE/boot-id")" = "$(cat /proc/sys/kernel/random/boot_id)" ]; then
  if [ -f "$STATE/binfmt-registered" ] && [ -e /proc/sys/fs/binfmt_misc/tango_translator ]; then
    echo -1 > /proc/sys/fs/binfmt_misc/tango_translator
  fi
  if [ -f "$STATE/mounts.list" ]; then
    "$BB" tac "$STATE/mounts.list" | while IFS= read -r target; do "$BB" umount -l "$target"; done
    : > "$STATE/mounts.list"
  fi
  "$BB" umount -l "$IMAGE" 2>/dev/null
  if [ -f "$STATE/binfmt-mounted" ]; then "$BB" umount /proc/sys/fs/binfmt_misc 2>/dev/null; fi
fi
rm -f "$STATE/binfmt-registered" "$STATE/binfmt-mounted"
restore_props
echo STOPPED > "$DATA/status"
