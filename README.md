# claude-stuff

My Claude Code user config (`~/.claude`), kept generic so it can move to a new machine.
Built for Terraform/OpenTofu + AWS + EKS infra work: Claude writes reviewed diffs, the human applies them.

## Contents

| Path | What |
| --- | --- |
| `CLAUDE.md` | User-level instructions: orchestrator role, no destructive commands, literal-path reads, code style, when to delegate to which agent |
| `settings.json` | Permissions (deny/ask lists for terraform, tofu, kubectl, helm, aws, git), model/effort, plugins and marketplaces. `__HOME__` is replaced at install |
| `agents/` | `deep-reasoner` (Fable, read-only), `implementer` (Opus), `fast-worker` (Haiku) |
| `hooks/guard-bash.sh` | PreToolUse guard that blocks destructive Bash commands however they are spelled. `bash hooks/run-tests.sh` runs its tests |
| `skills/create-mr` | `/create-mr`: split uncommitted changes into GitLab MRs (glab), one per scope, with the MR template |
| `skills/tidy-commits` | `/tidy-commits`: regroup a branch's commits, one change per commit, never pushes |
| `skills/sharpen` | `/sharpen <prompt>`: rewrite a rough prompt into a sharper one |
| `mods/usage-limits` | Five-hour / weekly rate-limit meters above the prompt (MIT fork of antiburn) |
| `mods/infra-context` | Band above the prompt: AWS SSO expiry, last EKS cluster / tofu project targeted, repo@branch; red on prod |
| `mods/run-by-hand` | Pane listing the commands Claude handed over to run by hand, and the Bash calls the guard blocked |

Not saved on purpose: credentials, history, projects/memory, plugin caches, Anthropic-synced skills, generated mod types.

## Install

```sh
git clone <this repo> ~/perso/claude-stuff
bash ~/perso/claude-stuff/install.sh
```

The script symlinks everything into `~/.claude` (so edits flow back to the repo) and skips anything that already exists.
`settings.json` is copied, not linked. Then:

- Add your repos to `permissions.additionalDirectories` in `~/.claude/settings.json`.
- Plugins listed in `enabledPlugins` install from `extraKnownMarketplaces` via `/plugin`.
- `usage-limits` loads through `CLAUDE_CODE_PLUGIN_DIRS`. `infra-context` and `run-by-hand` were developed as dev mods; load them the same way if wanted.
- `create-mr` uses `PROJ-NNNN` as the Jira key placeholder; the real key comes from the ticket URL you give it.
- `infra-context` expects `~/.eks-claude.sh <account> <region> <cluster>` (or `~/.eks.sh`) and the AWS profile `eks`; adjust the constants at the top of `mods/infra-context/hooks/register.tsx`.

### Wiring the Bash guard (optional)

`hooks/guard-bash.sh` is not referenced from `settings.json`. To enable it, add:

```json
"hooks": {
  "PreToolUse": [
    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "~/.claude/hooks/guard-bash.sh" }] }
  ]
}
```
