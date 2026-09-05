#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
# One bounded ps snapshot; no daemon, disk writes, hashes or per-process maps.
BB=/data/adb/ksu/bin/busybox
[ "$(id -u)" = 0 ] && [ -x "$BB" ] || exit 77
if [ "${1:-}" != --inside ]; then
  exec "$BB" timeout 8 "$BB" nsenter -t 1 -m sh "$0" --inside
fi
service=$(getprop init.svc.zygote_tango)
root=$(getprop init.svc_debug_pid.zygote_tango)
case "$root" in ''|*[!0-9]*) root=0;; esac
[ "$service" = running ] || root=0
# A stopped/missing zygote has no process tree. Avoid a system-wide ps scan.
if [ "$root" = 0 ]; then
  printf 'TANGO_MONITOR\t1\nSERVICE\t%s\nROOT\t0\nSUMMARY\t0\t0\t0\nEND\t1\n' "$service"
  exit 0
fi
snapshot=$(ps -A -o PID,PPID,RSS,NAME) || exit 1
printf 'TANGO_MONITOR\t1\nSERVICE\t%s\nROOT\t%s\n' "$service" "$root"
printf '%s\n' "$snapshot" | "$BB" awk -v root="$root" '
NR>1 && $1 ~ /^[0-9]+$/ && $2 ~ /^[0-9]+$/ && $3 ~ /^[0-9]+$/ {
  pid=$1; parent[pid]=$2; rss[pid]=$3; name[pid]=$4;
  children[$2]=children[$2] " " pid; present[pid]=1;
}
END {
  found=(root>0 && present[root]); count=0; total=0;
  if(found){queue[0]=root; end=1;
    for(i=0;i<end;i++){
      pid=queue[i];if(visited[pid])continue;visited[pid]=1;
      count++;total+=rss[pid];
      if(count<=100)printf "PROCESS\t%d\t%d\t%d\t%s\n",pid,parent[pid],rss[pid],name[pid];
      n=split(children[pid],list," ");for(j=1;j<=n;j++)if(list[j]!="")queue[end++]=list[j];
    }
  }
  printf "SUMMARY\t%d\t%d\t%d\nEND\t1\n",found,count,total;
}'
