#!/system/bin/sh
set -eu
MODDIR=${1:?module directory required}
. "$MODDIR/common.sh"
guard || { echo UNSUPPORTED_BUILD; exit 1; }
runtime_guard || { echo UNSUPPORTED_NETWORK_APEX; restore_props; exit 1; }
mkdir -p "$STATE" "$IMAGE"
BOOT=$(cat /proc/sys/kernel/random/boot_id)
if [ -f "$STATE/boot-id" ] && [ "$(cat "$STATE/boot-id")" = "$BOOT" ] && [ -s "$STATE/mounts.list" ]; then
  echo ALREADY_MOUNTED; exit 0
fi
printf '%s\n' "$BOOT" > "$STATE/boot-id"
rm -f "$STATE/binfmt-mounted" "$STATE/binfmt-registered"
: > "$STATE/mounts.list"
echo STARTING > "$DATA/status"
fail() { sh "$MODDIR/stop.sh" "$MODDIR"; echo FAILED > "$DATA/status"; }
trap fail EXIT
setprop ctl.stop zygote_tango
"$BB" mount -t ext4 -o loop,rw "$MODDIR/payload.img" "$IMAGE"
sh "$MODDIR/label.sh" "$IMAGE"
sh "$MODDIR/label_vendor.sh" "$IMAGE"
sync
"$BB" mount -o remount,ro "$IMAGE"
sh "$MODDIR/mount_runtime.sh" "$IMAGE" "$STATE"
props
if ! grep -q ' /proc/sys/fs/binfmt_misc ' /proc/self/mountinfo; then
  "$BB" mount -t binfmt_misc none /proc/sys/fs/binfmt_misc
  touch "$STATE/binfmt-mounted"
fi
if [ ! -e /proc/sys/fs/binfmt_misc/tango_translator ]; then
  printf ':tango_translator:M::\177ELF\001\001\001\000\000\000\000\000\000\000\000\000\002\000\050\000:\377\377\377\377\377\377\377\000\000\000\000\000\000\000\000\000\376\377\377\377:/system_ext/bin/tango_translator:POCF' > /proc/sys/fs/binfmt_misc/register
  touch "$STATE/binfmt-registered"
else
  echo 'Existing Tango binfmt registration; preserving it'
fi
/system_ext/bin/tango_translator "$IMAGE/tests/arm32_probe"
setprop ctl.start zygote_tango
i=0
while ! "$MODDIR/zygote_probe"; do
  i=$((i+1)); [ "$i" -lt 25 ] || exit 1
  sleep 1
done
sleep 4
[ "$(getprop init.svc.zygote_tango)" = running ] || exit 1
echo READY > "$DATA/status"
trap - EXIT
echo TANGO32_READY
