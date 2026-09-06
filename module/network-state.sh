#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
# Small atomic progress record. Readers never hash JARs or launch probes.
zygote_identity() {
  identity_pid=${1:-$(getprop init.svc_debug_pid.zygote_tango)}
  case "$identity_pid" in ''|0|*[!0-9]*) return 1;; esac
  read -r identity_stat < "/proc/$identity_pid/stat" || return 1
  identity_stat=${identity_stat##*) }
  set -- $identity_stat
  [ "$#" -ge 20 ] || return 1
  shift 19
  printf '%s:%s\n' "$identity_pid" "$1"
}
network_event() {
  event_now=$(cut -d. -f1 /proc/uptime)
  event_begin=${NETWORK_BEGIN:-$event_now}
  event_tmp=$DATA/network-state.$$
  (umask 077; printf '%s\n%s\n%s\n%s\n%s\n%s\n' \
    "$(cat /proc/sys/kernel/random/boot_id)" "$1" "${2:-none}" "${key:-${network_key:-none}}" \
    "$((event_now-event_begin))" "$(date +%s)" > "$event_tmp") && mv -f "$event_tmp" "$DATA/network-state"
}
network_read_state() {
  NET_STAGE=unknown NET_REASON=none NET_KEY=none NET_SECONDS=0 NET_TIME=0
  [ -f "$DATA/network-state" ] || return 0
  {
    read -r event_boot && read -r event_stage && read -r event_reason &&
    read -r event_key && read -r event_seconds && read -r event_time
  } < "$DATA/network-state" || return 0
  [ "$event_boot" = "$(cat /proc/sys/kernel/random/boot_id)" ] || return 0
  case "$event_stage" in checking|generating|cached|prepared|mounting|probing|ready|failed|stopped) ;; *) return 0;; esac
  case "$event_reason" in ''|*[!a-zA-Z0-9_-]*) return 0;; esac
  case "$event_key" in none) ;; ''|*[!0-9a-f]*) return 0;; esac
  case "$event_seconds:$event_time" in *[!0-9:]*|:*|*:) return 0;; esac
  NET_STAGE=$event_stage NET_REASON=$event_reason NET_KEY=$event_key NET_SECONDS=$event_seconds NET_TIME=$event_time
}
