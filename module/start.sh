#!/system/bin/sh
set -eu
MODDIR=${1:?module directory required}
. "$MODDIR/common.sh"
guard || { echo UNSUPPORTED_BUILD; exit 1; }
mkdir -p "$STATE" "$IMAGE"
BOOT=$(cat /proc/sys/kernel/random/boot_id)
if [ -f "$STATE/boot-id" ] && [ "$(cat "$STATE/boot-id")" = "$BOOT" ] && [ -s "$STATE/mounts.list" ]; then
  echo ALREADY_MOUNTED; exit 0
fi
if ! sh "$MODDIR/network-prepare.sh" > "$DATA/network-prepare.log" 2>&1; then
  echo NETWORK_PREPARE_FAILED | tee "$DATA/status"
  cat "$DATA/network-prepare.log"
  restore_props; exit 1
fi
runtime_guard && [ "$NETWORK_MODE" = dynamic ] || { echo UNSUPPORTED_NETWORK_APEX | tee "$DATA/status"; restore_props; exit 1; }
printf '%s\n' "$BOOT" > "$STATE/boot-id"
rm -f "$STATE/binfmt-mounted" "$STATE/binfmt-registered"
: > "$STATE/mounts.list"
echo STARTING > "$DATA/status"
probing=0
fail() {
  [ "$probing" != 1 ] || touch "$NETWORK_COMPAT/startup-failed"
  sh "$MODDIR/stop.sh" "$MODDIR"
  echo FAILED > "$DATA/status"
}
trap fail EXIT
setprop ctl.stop zygote_tango
"$BB" mount -t ext4 -o loop,rw "$MODDIR/payload.img" "$IMAGE"
sh "$MODDIR/label.sh" "$IMAGE"
sh "$MODDIR/label_vendor.sh" "$IMAGE"
sync
"$BB" mount -o remount,ro "$IMAGE"
sh "$MODDIR/mount_runtime.sh" "$IMAGE" "$STATE"
if [ -n "$NETWORK_COMPAT" ]; then
  # Only the private ARM32 launcher consumes these jars. The global networking
  # APEX and the system_server/ARM64 class paths remain unchanged.
  network_target=/system_ext/tango32/apex-javalib/com.android.tethering
  chcon -R u:object_r:system_file:s0 "$NETWORK_COMPAT"
  "$BB" mount --bind "$NETWORK_COMPAT" "$network_target"
  printf '%s\n' "$network_target" >> "$STATE/mounts.list"
  "$BB" mount -o remount,bind,ro "$network_target"
  printf '%s\n' "$NETWORK_MODE" > "$STATE/network-mode"
fi
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
probing=1
if ! CLASSPATH=$MODDIR/network-tools/network-merger.jar "$BB" timeout 25 /system/bin/app_process32 /system/bin NetworkNativeProbe > "$DATA/network-probe.log" 2>&1; then
  cat "$DATA/network-probe.log"; exit 1
fi
grep -q '^NETWORK_JNI_LOAD_OK$' "$DATA/network-probe.log" || exit 1
echo NETWORK_JNI_LOAD_OK
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
