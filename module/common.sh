#!/system/bin/sh
BB=/data/adb/ksu/bin/busybox
RP=/data/adb/ksu/bin/resetprop
DATA=/data/adb/tango32_findx9u
STATE=$DATA/runtime
IMAGE=$DATA/image
guard() {
  [ "$(getprop ro.product.model)" = CPH2841 ] &&
  [ "$(getprop ro.build.display.id)" = 'CPH2841_16.0.10.500(EX01)' ] &&
  [ "$(getprop ro.build.version.ota)" = CPH2841_11.A.63_0630_202607311128 ] &&
  [ -c /dev/tango32 ] && [ -x "$BB" ]
}
runtime_guard() {
  [ "$(sha256sum /apex/com.android.tethering/javalib/framework-connectivity.jar | cut -d' ' -f1)" = 6eff44d2aa85ccd0552c32d838f0501526fd00173ebb4315d2eff6b917a30d2e ]
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
