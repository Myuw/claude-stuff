---
name: sharpen
description: Rewrite a rough prompt into a sharper one by naming what an expert would add, their raw material, methods, and proof of correctness. User-invoked only.
argument-hint: <rough prompt>
disable-model-invocation: true
---
Rough prompt: $ARGUMENTS

Do NOT do the task. Read only what grounds the answers (known paths in the current repo, a quick grep); no agents, no other commands.

Answer each in 1-3 bullets:
1. What an expert on this repo would do here that the prompt doesn't ask for. Only what changes the outcome; scope stays the user's call.
2. The raw material they'd start from: exact files, modules, env configs, docs, logs, tickets.
3. Their methods and tools: commands, validators (fmt/validate/jq, tofu in OpenTofu repos), repo patterns to follow.
4. What would prove the result right: done-criterion, checks to run, commands the user must run by hand.

Then give the rewritten prompt in one code block, ready to paste, with point-1 additions marked "(optional)". Stop and wait.
