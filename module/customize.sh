SKIPUNZIP=0
ui_print "- ColorOS Global TangoBridge for CPH2841 EX01 500"
[ "$KSU" = true ] || abort "KernelSU-compatible manager required"
. "$MODPATH/common.sh"
guard || abort "Unsupported device/build or Tango kernel interface missing"
(cd "$MODPATH" && sha256sum -c payload.sha256) || abort "Payload checksum failed"
set_perm_recursive "$MODPATH" 0 0 0755 0644
for f in "$MODPATH"/*.sh; do set_perm "$f" 0 0 0755; done
set_perm "$MODPATH/zygote_probe" 0 0 0755
ui_print "- Installed. Reboot to enable; Action shows status."
