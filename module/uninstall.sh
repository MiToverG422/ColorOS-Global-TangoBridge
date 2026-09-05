#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/common.sh"
sh "$MODDIR/monitor-control.sh" disable >/dev/null 2>&1
"$BB" nsenter -t 1 -m sh "$MODDIR/stop.sh" "$MODDIR"
