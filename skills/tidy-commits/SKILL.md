---
name: tidy-commits
description: Regroup the current branch's commits so each one does exactly one thing - fold fix-ups into the commit they fix, split mixed commits, rebase onto the latest default branch. Shows the new commit list and waits for approval; never pushes.
disable-model-invocation: true
---

# Tidy commits

Rewrite the current branch into a short history a reviewer can read commit by commit.
The final code stays exactly the same; only the commits change.
Running /tidy-commits is the user's explicit request to use git on this branch.

## Rules

- One commit = one change you can describe in one line.
- A fix of something added earlier in the branch (rename, "fix if condition", a line added then removed) folds into the commit that added it. It is not its own commit.
- A commit that mixes unrelated changes gets split.
- Every commit works on its own: don't remove a variable before the commit that stops using it.
- Split by file. If a split needs part of a file, stop and ask the user.
- Don't change content. Dead code, bugs or leftovers you spot: flag them and offer a separate commit.
- Never push, `reset --hard`, `branch -D`, `clean`. Print those commands for the user.
- Keep the original author and no Co-Authored-By trailer: it is the author's work, regrouped.

## 1. Inspect

- `git status -sb`: branch and upstream. Default branch from `git symbolic-ref refs/remotes/origin/HEAD` (fallback `main`), then `git fetch origin`; the base is `origin/<default>`.
- Stop and ask if there are uncommitted changes to tracked files, merge commits in the branch, or commits by other authors.
- Read it all: `git log --stat <base>..HEAD`, then `git log -p --reverse <base>..HEAD`.
- Message style: `git log -20 --format='%s%n%b' <base>`. Copy it (type, scope, subject only or with a body).
- What moved on the base: `git merge-base HEAD <base>` gives the old merge base, then `git diff --stat <old merge-base> <base>`. Watch for renames: they affect the rebase and the verify step.

## 2. Plan and wait

Show this table, oldest first, then stop until the user says OK:

| # | New commit | Built from | Files |
|---|------------|------------|-------|

Under it, one line per fold ("`d9c1a046` only fixes lines from `2734fc1c`") and per flag.
If the user says a commit is too big, split it and show the table again.

## 3. Rewrite

1. `git branch backup/<branch>`
2. Write the rebase todo with the Write tool in the scratchpad (not a heredoc: if the Bash call is rejected, the file never exists).
3. `GIT_SEQUENCE_EDITOR="cp <literal todo path>" git rebase -i <base>`

Todo patterns:

- Fold: `pick A`, `fixup B`, `fixup C`, then `exec git commit --amend -q -m "<message>"`.
- Reword: `pick A`, then `exec git commit --amend -q -m "<message>"`.
- Reorder: move the lines. Safe when the commits touch different files.
- Split: everything in one `exec` line, because the rebase stops after any exec that leaves the tree dirty:
  `exec git reset -q HEAD^ && git add <paths 1> && git commit -q -m "<m1>" && git add <paths 2> && git commit -q -m "<m2>"`
  (`git add <dir>` also stages deletions.)

On a conflict or a stop: show it and ask (resolve, or `git rebase --abort`).

## 4. Verify

- Same final code: compare `git diff <old merge-base> backup/<branch>` with `git diff <base> HEAD`, ignoring `index` lines. Any difference must come from the base (a file renamed there, for example).
- `git log --stat --reverse <base>..HEAD`: each commit touches only its planned files.
- For each variable or key a commit removes, `git grep` at that commit finds no use left.
- `git status`: nothing left uncommitted.

## 5. Report

The final table with new hashes, what was verified and what was not (nothing was run: no playbook, no plan), the flagged items, then:

```sh
git push --force-with-lease origin <branch>
git branch -D backup/<branch>   # once happy
```
