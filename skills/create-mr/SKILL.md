---
name: create-mr
description: Turn the uncommitted changes into one or more GitLab MRs, one per scope - branch from origin/main, commit, push, glab mr create with our template. Shows the split and the MR texts and waits for approval before any git write.
disable-model-invocation: true
allowed-tools:
  - Bash(git fetch *)
  - Bash(git switch *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push -u origin *)
  - Bash(glab mr list *)
  - Bash(glab mr view *)
  - Bash(glab mr create *)
---

# Create MR

Running /create-mr is the user's explicit request to branch, commit, push and open MRs for this work.
That permission covers this run only.

## Rules

- One MR = one scope (one component, role or env). Different scopes go in different branches and MRs.
- Every branch starts from `origin/<default>`. Never stack branches.
- Split by file. If one file holds two scopes, stop and ask.
- Never force push, `reset --hard`, `branch -D`, push to the default branch, or amend a pushed commit.
- Never add a Co-Authored-By trailer or a "Generated with Claude Code" line: the code is the user's work.
- Don't invent facts in the MR text (tests run, deploy steps). Ask.

## 1. Inspect

- `git status -sb`: note the starting branch. Default branch from `git symbolic-ref refs/remotes/origin/HEAD` (fallback `main`), then `git fetch origin`.
- Stop and ask if the current branch has commits not on `origin/<default>`.
- Read the changes: `git diff`, `git diff --stat`, and the untracked files.
- Style: `git log -15 --format=%s origin/<default>` for subjects, `git branch -r --sort=-committerdate` for branch names, `glab mr list --merged --author=@me --per-page 10` then `glab mr view <iid>` on 3 of them for the tone and length of descriptions.

## 2. Plan and wait

Ask for the Jira ticket key (`PROJ-NNNN`) and any support Slack thread link of each MR if the user didn't give them. Several MRs can share them, and an MR can have none.
A Jira URL (`.../browse/PROJ-1234`) gives the ticket key. `PROJ` below stands for the real project key.

Show this table, then stop until the user says OK:

| # | Branch | Files | Commits |
|---|--------|-------|---------|

- Branch: `<type>/<short-slug>-<proj>-<NNNN>` (key lowercased), e.g. `feat/incidents-alert-channel-proj-2083`. No ticket: `<type>/<short-slug>`.
- Commit subject: `type(scope): component - what`, several components joined by `/`.
  The first commit of the branch ends with ` PROJ-NNNN` when there is a ticket; it is also the MR title. Other commits have no ticket.
- One commit per MR unless the MR holds clearly separate changes.

In the same message, ask what is still unknown for the MR texts: why the change (if the diff doesn't say), what was tested, how to deploy.
Find deploy targets yourself before asking: the playbook that imports the role (`ansible/playbooks/`), its tag and `when:` feature flag, then the hosts setting that flag in `host_vars`/`group_vars`.

## 3. Write the MR texts

For each MR, fill `template.md` (next to this file) and write it with the Write tool to `<scratchpad>/mr-<n>.md`:

- Remove every `(...)` placeholder line.
- Plain and short, like the past MRs. No bold, no bullet lists of benefits, no closing sentence.
- Description: why, then what changes. One to three sentences.
- How do you test it: `:white_check_mark: I was able to:` and the exact command in a ```bash block. Nothing run: `:x:`. Unknown: ask.
- How to deploy: `:white_check_mark: Todo:` and the exact `make ...` command in a ```bash block. Unknown: ask.
  When the user tested with the deploy command, the same command goes in both sections (test may target one env, deploy all).
- References: the Slack thread link and other links if any, one per line, then the bare ticket `PROJ-NNNN` (no "Closes", no Jira URL). No ticket and no link: `:x:`.

Then run the `humanizer:humanizer` skill on each text and write the result back to the same file.
Show the final title and description of every MR and stop until the user says OK.

## 4. Check

On the files of each MR, with literal paths:

- `.tf`: `tofu fmt -check <dir>` in OpenTofu repos, `terraform fmt -check <dir>` elsewhere.
- `.json`: `jq . <file>`.

A failure: show it and stop.

## 5. Create

For each MR, in order:

```sh
git switch -c <branch> origin/<default>
git add <file> <file>
git commit -m "<subject>"
git push -u origin <branch>
glab mr create --source-branch <branch> --target-branch <default> --title "<title>" --description "$(cat <literal path to mr-n.md>)" --assignee @me --yes
```

The uncommitted files of the next MRs follow along on each `git switch`.
If `git switch` refuses (a local change conflicts with `origin/<default>`), stop and ask.

At the end: `git switch <starting branch>`.

## 6. Report

No reviewer: the user posts the MRs in the team Slack channel.
First a block ready to paste there, one line per MR: `<title> <URL>`.
Then what was checked, what was not (nothing applied: no plan, no playbook run), and what is left uncommitted.
