#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/common.sh"
guard || exit 0
mkdir -p "$DATA"
i=0
while [ "$(getprop sys.boot_completed)" != 1 ]; do
  i=$((i+1)); [ "$i" -lt 180 ] || exit 1
  sleep 1
done
[ ! -f "$MODDIR/disable" ] && [ ! -f "$MODDIR/remove" ] || exit 0
"$BB" nsenter -t 1 -m sh "$MODDIR/start.sh" "$MODDIR" >> "$DATA/startup.log" 2>&1
sh "$MODDIR/monitor-control.sh" restore >/dev/null 2>&1
