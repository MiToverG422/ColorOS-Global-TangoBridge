#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
set -eu
MODDIR=${0%/*}
. "$MODDIR/common.sh"
[ "$(id -u)" = 0 ] && guard || exit 77
umask 077
mkdir -p "$DATA" "$NETWORK_CACHE"
if [ "${1:-prepare}" != --locked ]; then
  case "${1:-prepare}" in prepare|retry) ;; *) exit 64;; esac
  exec "$BB" timeout 150 "$BB" flock "$DATA/network.lock" sh "$0" --locked "${1:-prepare}"
fi
NETWORK_BEGIN=$(cut -d. -f1 /proc/uptime)
reason=tool_integrity
stage=
cleanup() {
  result=$?
  if [ -n "$stage" ]; then rm -f "$stage"/*; rmdir "$stage" 2>/dev/null || true; fi
  [ "$result" = 0 ] || network_event failed "$reason"
  exit "$result"
}
trap cleanup EXIT
network_event checking
tools=$MODDIR/network-tools
(cd "$tools" && sha256sum -c SHA256SUMS >/dev/null)
reason=input_read
key=$(network_fingerprint)
case "$key" in ''|*[!0-9a-f]*) exit 1;; esac
dest=$NETWORK_CACHE/$key
if [ -f "$dest/startup-failed" ]; then
  reason=previous_start
  [ "${2:-prepare}" = retry ] || { echo 'NETWORK_PREVIOUS_START_FAILED: explicit retry or a component/tool change is required'; exit 1; }
  rm -f "$dest/startup-failed"
fi
if network_cached; then network_event cached; echo "NETWORK_CACHE_HIT $key"; exit 0; fi
# Do not delete existing caches: a running ARM32 namespace may still use them.
count=0
for old in "$NETWORK_CACHE"/*; do [ ! -d "$old" ] || count=$((count+1)); done
reason=cache_limit
[ "$count" -lt 8 ] || { echo 'NETWORK_CACHE_LIMIT: inspect old caches before removing them'; exit 1; }
reason=cache_corrupt
[ ! -e "$dest" ] || { echo 'NETWORK_CACHE_CORRUPT: retained for inspection'; exit 1; }
reason=input_copy
stage=$NETWORK_CACHE/.prepare.$$
mkdir "$stage"
set -- "$NETWORK_SOURCE"/*.jar
[ "$#" -le 32 ] && [ -f "$1" ]
total=0
for input in "$@"; do
  name=${input##*/}
  case "$name" in *[!a-zA-Z0-9._-]*) echo 'NETWORK_INVALID_FILENAME'; exit 1;; esac
  size=$(wc -c < "$input"); total=$((total+size))
  [ "$total" -le 67108864 ] || { echo 'NETWORK_INPUT_SIZE_LIMIT'; exit 1; }
  cp "$input" "$stage/$name"
done
(cd "$NETWORK_SOURCE" && sha256sum ./*.jar) > "$stage/SOURCE_SHA256SUMS"
(cd "$stage" && sha256sum -c SOURCE_SHA256SUMS >/dev/null)
reason=input_changed
[ "$(network_fingerprint)" = "$key" ] || { echo 'NETWORK_INPUT_CHANGED'; exit 1; }
# A bounded, low-priority ARM64 tool; no app is installed and no network is used.
chmod 444 "$tools/network-merger.jar"
reason=merge
network_event generating
CLASSPATH=$tools/network-merger.jar "$BB" timeout 120 "$BB" nice -n 10 /system/bin/app_process64 -Xmx192m /system/bin MergeConnectivity \
  "$stage/framework-connectivity.jar" "$tools/donor.jar" "$stage/merged.jar"
mv "$stage/merged.jar" "$stage/framework-connectivity.jar"
reason=input_changed
[ "$(network_fingerprint)" = "$key" ] || { echo 'NETWORK_INPUT_CHANGED'; exit 1; }
(cd "$stage" && sha256sum ./*.jar SOURCE_SHA256SUMS) > "$stage/ready.sha256"
reason=publish
chmod 755 "$stage"
chmod 644 "$stage"/*
# Publish only a complete directory; failures never expose a partial cache.
mv "$stage" "$dest"
stage=
network_event prepared
echo "NETWORK_GENERATED $key"
