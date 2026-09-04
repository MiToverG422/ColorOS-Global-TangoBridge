#!/system/bin/sh
set -eu
STAGE=${1:?payload mountpoint required}
STATE=${2:?state directory required}
BB=/data/adb/ksu/bin/busybox
mkdir -p "$STATE/original"
: > "$STATE/mounts.list"
record() { printf '%s\n' "$1" >> "$STATE/mounts.list"; }
merge() {
    src=$1
    target=$2
    name=$3
    backup=$STATE/original/$name
    mkdir -p "$backup"
    $BB mount --rbind "$target" "$backup"
    $BB mount --make-rprivate "$backup"
    record "$backup"
    $BB mount -t overlay -o ro,lowerdir=$src:$target KSU "$target"
    record "$target"
    # Preserve other modules and vendor submounts in untouched top-level trees.
    for old in "$backup"/*; do
        leaf=${old##*/}
        if [ -d "$old" ] && [ ! -L "$old" ] && [ ! -e "$src/$leaf" ]; then
            $BB mount --rbind "$old" "$target/$leaf"
            record "$target/$leaf"
        fi
    done
}
merge "$STAGE/root/system/bin" /system/bin system-bin
merge "$STAGE/root/system/lib" /system/lib system-lib
merge "$STAGE/root/system_ext" /system_ext system-ext
merge "$STAGE/root/vendor/lib" /vendor/lib vendor-lib
for src in "$STAGE"/apex/*; do
    name=${src##*/}
    if [ -d "/apex/$name" ]; then
        merge "$src" "/apex/$name" "apex-$name"
    fi
done
echo 'TANGO32_MOUNTS_READY'
