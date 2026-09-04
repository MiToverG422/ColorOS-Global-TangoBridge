#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/common.sh"
guard || exit 0
props
