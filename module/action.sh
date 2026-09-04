#!/system/bin/sh
MODDIR=${0%/*}
. "$MODDIR/common.sh"
echo 'ColorOS Global TangoBridge 0.2.1-test'
echo "Build: $(getprop ro.build.display.id)"
echo "Status: $(cat "$DATA/status" 2>/dev/null)"
echo "Service: $(getprop init.svc.zygote_tango)"
echo "ABI32: $(getprop ro.product.cpu.abilist32)"
echo 'Disable this module and reboot to revert.'
