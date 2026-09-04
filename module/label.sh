#!/system/bin/sh
set -eu
BASE=${1:?image mountpoint required}
label() { context=$1; shift; chcon -hR "$context" "$@"; }
label u:object_r:system_file:s0 "$BASE/root/system" "$BASE/root/system_ext" "$BASE/apex"
label u:object_r:system_lib_file:s0 "$BASE/root/system/lib" "$BASE/root/system_ext/lib"
label u:object_r:vendor_file:s0 "$BASE/root/vendor"
for lib in "$BASE"/apex/*/lib; do
    label u:object_r:system_lib_file:s0 "$lib"
done
chcon u:object_r:zygote_exec:s0 "$BASE/root/system/bin/app_process32"
chcon u:object_r:system_linker_exec:s0 "$BASE/apex/com.android.runtime/bin/linker"
chcon u:object_r:crash_dump_exec:s0 "$BASE/apex/com.android.runtime/bin/crash_dump32"
chcon u:object_r:dex2oat_exec:s0 "$BASE/apex/com.android.art/bin/dex2oat32"
chcon u:object_r:tango32_exec:s0 "$BASE/root/system_ext/bin/tango_translator"
sync
