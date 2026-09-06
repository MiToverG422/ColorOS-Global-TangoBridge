#!/system/bin/sh
BB=/data/adb/ksu/bin/busybox
RP=/data/adb/ksu/bin/resetprop
DATA=/data/adb/tango32_findx9u
STATE=$DATA/runtime
IMAGE=$DATA/image
NETWORK_SOURCE=/apex/com.android.tethering/javalib
NETWORK_CACHE=$DATA/network-cache
. "${MODPATH:-${MODDIR}}/network-state.sh"
network_fingerprint() {
  network_inputs=$(cd "$NETWORK_SOURCE" && sha256sum ./*.jar) || return 1
  network_tools=$(cd "$MODDIR/network-tools" && sha256sum donor.jar network-merger.jar) || return 1
  network_script=$(sha256sum "$MODDIR/network-prepare.sh") || return 1
  printf 'network-cache-v1\n%s\n%s\n%s\n' "$network_inputs" "$network_tools" "${network_script%% *}" | "$BB" sha256sum | cut -d' ' -f1
}
network_cached() {
  network_key=$(network_fingerprint) || return 1
  case "$network_key" in ''|*[!0-9a-f]*) return 1;; esac
  NETWORK_COMPAT=$NETWORK_CACHE/$network_key
  [ ! -e "$NETWORK_COMPAT/startup-failed" ] &&
  [ -f "$NETWORK_COMPAT/ready.sha256" ] &&
  (cd "$NETWORK_COMPAT" && sha256sum -c ready.sha256 >/dev/null)
}
guard() {
  [ "$(getprop ro.product.model)" = CPH2841 ] &&
  [ "$(getprop ro.build.display.id)" = 'CPH2841_16.0.10.500(EX01)' ] &&
  [ "$(getprop ro.build.version.ota)" = CPH2841_11.A.63_0630_202607311128 ] &&
  [ -c /dev/tango32 ] && [ -x "$BB" ]
}
runtime_guard() {
  NETWORK_COMPAT=
  NETWORK_MODE=unsupported
  network_hash=$(sha256sum /apex/com.android.tethering/javalib/framework-connectivity.jar | cut -d' ' -f1)
  if network_cached 2>/dev/null; then NETWORK_MODE=dynamic; return 0; fi
  NETWORK_COMPAT=
  case "$network_hash" in
    6eff44d2aa85ccd0552c32d838f0501526fd00173ebb4315d2eff6b917a30d2e) NETWORK_MODE=legacy; return 0 ;;
    e0011823d4086d6189965688d263fc92309a64e6186b1bf5fd93a5b69fb3909f)
      NETWORK_COMPAT=$MODDIR/network/factory-361524320
      (cd "$NETWORK_COMPAT" && sha256sum -c SHA256SUMS >/dev/null) || return 1
      (cd /apex/com.android.tethering/javalib && sha256sum -c "$NETWORK_COMPAT/ORIGINAL_SHA256SUMS" >/dev/null) || return 1
      NETWORK_MODE=factory
      ;;
    *) return 1 ;;
  esac
}
props() {
  mkdir -p "$DATA"
  if [ ! -f "$DATA/original.props" ]; then
    for p in ro.product.cpu.abilist ro.product.cpu.abilist32 ro.system.product.cpu.abilist ro.system.product.cpu.abilist32 ro.vendor.product.cpu.abilist ro.vendor.product.cpu.abilist32 ro.sys.oplus_support_app32_version; do
      printf '%s=%s\n' "$p" "$(getprop "$p")" >> "$DATA/original.props"
    done
  fi
  for p in ro.product.cpu.abilist ro.system.product.cpu.abilist ro.vendor.product.cpu.abilist; do
    "$RP" -n "$p" arm64-v8a,armeabi-v7a,armeabi
  done
  for p in ro.product.cpu.abilist32 ro.system.product.cpu.abilist32 ro.vendor.product.cpu.abilist32; do
    "$RP" -n "$p" armeabi-v7a,armeabi
  done
  "$RP" -n ro.sys.oplus_support_app32_version 2
}
restore_props() {
  [ -f "$DATA/original.props" ] || return 0
  while IFS='=' read -r p v; do "$RP" -n "$p" "$v"; done < "$DATA/original.props"
}
