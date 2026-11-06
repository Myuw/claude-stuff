#!/usr/bin/env bash
# Runs guard-bash.sh against guard-bash.tests. Usage: bash ~/.claude/hooks/run-tests.sh
d=$(dirname "$0"); fail=0; n=0
while IFS=$'\t' read -r exp cmd; do
  case "$exp" in B|A) ;; *) continue ;; esac
  n=$((n+1))
  jq -n --arg c "$cmd" '{tool_name:"Bash",tool_input:{command:$c}}' \
    | HOME=$(mktemp -d) bash "$d/guard-bash.sh" 2>/dev/null
  rc=$?
  got=A; [ $rc -eq 2 ] && got=B
  [ "$got" != "$exp" ] && { echo "FAIL expected=$exp got=$got : $cmd"; fail=$((fail+1)); }
done < "$d/guard-bash.tests"
echo "$((n-fail))/$n passed"
[ $fail -eq 0 ]
