SKIPUNZIP=0
ui_print "- ColorOS Global TangoBridge for 16.0.10.500(EX01)"
ui_print "- Currently supports Snapdragon processors only."
[ "$KSU" = true ] || abort "KernelSU-compatible manager required"
. "$MODPATH/common.sh"
guard || abort "Unsupported device/build or Tango kernel interface missing"
(cd "$MODPATH" && sha256sum -c payload.sha256) || abort "Payload checksum failed"
set_perm "$MODPATH" 0 0 0755
# The manager handles WebUI permissions and SELinux labels itself.
for entry in "$MODPATH"/*; do
  [ "${entry##*/}" = webroot ] || set_perm_recursive "$entry" 0 0 0755 0644
done
for f in "$MODPATH"/*.sh; do set_perm "$f" 0 0 0755; done
set_perm "$MODPATH/zygote_probe" 0 0 0755
ui_print "- Installed. Reboot to enable; open WebUI to view status."
