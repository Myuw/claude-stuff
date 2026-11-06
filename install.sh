#!/usr/bin/env bash
# Links this repo's Claude Code config into ~/.claude. Never overwrites: existing entries are reported and skipped.
# settings.json is copied (not linked) with __HOME__ replaced, since it holds machine-specific paths.
set -u
repo=$(cd "$(dirname "$0")" && pwd)
dest="$HOME/.claude"
mkdir -p "$dest/agents" "$dest/hooks" "$dest/skills" "$dest/mods"

link() {
  if [ -e "$2" ] || [ -L "$2" ]; then
    echo "skip   $2 (exists)"
  else
    ln -s "$1" "$2" && echo "linked $2"
  fi
}

link "$repo/CLAUDE.md" "$dest/CLAUDE.md"
for f in "$repo"/agents/*.md; do link "$f" "$dest/agents/$(basename "$f")"; done
for f in "$repo"/hooks/*; do link "$f" "$dest/hooks/$(basename "$f")"; done
for d in "$repo"/skills/*/; do link "${d%/}" "$dest/skills/$(basename "$d")"; done
for d in "$repo"/mods/*/; do link "${d%/}" "$dest/mods/$(basename "$d")"; done

if [ -e "$dest/settings.json" ]; then
  echo "skip   $dest/settings.json (exists); compare with: diff <(sed 's|__HOME__|$HOME|g' $repo/settings.json) $dest/settings.json"
else
  sed "s|__HOME__|$HOME|g" "$repo/settings.json" > "$dest/settings.json" && echo "wrote  $dest/settings.json"
fi
