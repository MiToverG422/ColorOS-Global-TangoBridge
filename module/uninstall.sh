#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/common.sh"
"$BB" nsenter -t 1 -m sh "$MODDIR/stop.sh" "$MODDIR"
