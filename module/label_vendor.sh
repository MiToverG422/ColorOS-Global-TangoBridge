#!/system/bin/sh
set -eu
BASE=${1:?image mountpoint required}/root/vendor/lib
find "$BASE" -type f | while IFS= read -r file; do
  relative=${file#"$BASE"/}
  original=/vendor/lib64/$relative
  [ -e "$original" ] || continue
  context=$(ls -Zd "$original" | awk '{print $1}')
  case "$context" in u:object_r:*:s0) chcon "$context" "$file";; esac
done
