#!/usr/bin/env bash
# PreToolUse guard for Bash: blocks destructive / state-changing commands
# whatever the spelling (full paths, flag order, sh -c wrapping, chains).
# Exit 2 = block (stderr is shown to Claude). Exit 0 = let normal permissions decide.
# Log: ~/.claude/hooks/guard-bash.log

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null) || {
  echo "guard-bash: could not parse hook input; blocking to be safe" >&2; exit 2; }
[ -z "$cmd" ] && exit 0

# Split on command separators so one segment = one command (quotes are ignored on purpose:
# over-splitting only makes the check stricter, and it also exposes `sh -c '...'` payloads).
segments=$(printf '%s' "$cmd" | sed -E 's/(\|\||&&|[;|&`]|\$\(|\(|\)|\n)/\n/g')

# Word boundary before a program name: start, whitespace, quote, or a path slash.
B="(^|[[:space:]'\"/])"
# Word boundary after a subcommand: end, whitespace or a closing quote.
E="([[:space:]'\"]|$)"

rules=(
  "terraform/tofu state change|${B}(terraform|tofu)([[:space:]].*)?[[:space:]](apply|destroy|import|taint|untaint|force-unlock|state[[:space:]]+(rm|mv|push|replace-provider))${E}"
  "make infra target|${B}make([[:space:]].*)?[[:space:]](tf-apply[^[:space:]]*|tf-destroy[^[:space:]]*|tf-state-rm[^[:space:]]*|tofu-apply|tofu-destroy|tofu-import)${E}"
  "kubectl mutation|${B}kubectl([[:space:]].*)?[[:space:]](delete|drain|apply|patch|scale|replace|rollout|edit|cordon|uncordon|taint|create|set|label|annotate)${E}"
  "helm mutation|${B}helm([[:space:]].*)?[[:space:]](install|upgrade|uninstall|delete|rollback)${E}"
  "aws delete/terminate|${B}aws([[:space:]].*)?[[:space:]]([a-z0-9-]*(delete|terminate|remove|deregister)[a-z0-9-]*|rm|rb)${E}"
  "recursive rm|${B}rm([[:space:]]+[^[:space:]]+)*[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)${E}"
  "find -delete|${B}find([[:space:]].*)?[[:space:]](-delete|-exec[[:space:]]+(rm|shred))${E}"
  "git force push|${B}git([[:space:]].*)?[[:space:]]push([[:space:]].*)?[[:space:]](-f|--force|--force-with-lease[^[:space:]]*|--mirror|--delete|-d)${E}"
  "git force push|${B}git([[:space:]].*)?[[:space:]]push([[:space:]].*)?[[:space:]]\+[^[:space:]]+"
  "git history/worktree wipe|${B}git([[:space:]].*)?[[:space:]](reset[[:space:]]+(.*[[:space:]])?--hard|clean([[:space:]]|$)|branch[[:space:]]+(.*[[:space:]])?-D|stash[[:space:]]+(drop|clear))"
  "disk wipe|${B}(shred|mkfs[^[:space:]]*|wipefs)([[:space:]]|$)|${B}dd[[:space:]].*of="
)

while IFS= read -r seg; do
  [ -z "${seg//[[:space:]]/}" ] && continue
  for r in "${rules[@]}"; do
    name=${r%%|*}; re=${r#*|}
    if printf '%s' "$seg" | grep -Eq -- "$re"; then
      printf '%s BLOCKED [%s] %s\n' "$(date -Is)" "$name" "$cmd" >> "$HOME/.claude/hooks/guard-bash.log" 2>/dev/null
      echo "guard-bash: blocked ($name). Never run this; print the command for the user to run by hand (see CLAUDE.md)." >&2
      exit 2
    fi
  done
done <<< "$segments"
exit 0
