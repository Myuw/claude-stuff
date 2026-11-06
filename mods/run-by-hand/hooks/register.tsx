import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Step } from '../types'

const PANE = 'run-by-hand'
const TITLE = 'Run by hand'
// Change the tag when Step changes: it declines what an earlier version stored
const steps = atom({ plugin: 'run-by-hand', key: 'steps' } as const, [], { shape: 'steps-1' })

const FENCE = /```(?:bash|sh|shell|zsh|console)?[ \t]*\n([\s\S]*?)```/g
// a block is kept when one of its lines starts with one of these
const RUNNABLE = /^(?:[A-Z_]+=\S*\s+)*(?:make|tofu|terraform|kubectl|helm|aws|git|vault|ansible-playbook|sudo|claude|\.|source)\s/m
// guard-bash's stderr, and the engine's wording for a settings deny rule
const BLOCKED = /guard-bash: blocked|has been denied/i
const KEEP = 50
const SHOWN = 10

const fromAnswer = (answer: string) =>
  [...answer.matchAll(FENCE)]
    .map(match => (match[1] ?? '').replace(/^[$!]\s+/gm, '').trim())
    .filter(block => RUNNABLE.test(block))

const syncStatus = async ($: EngineInterface) => {
  const count = (await read($, steps)).length
  $.ui.status(count > 0 ? `${count} to run by hand (/runbook)` : undefined)
}

const add = async ($: EngineInterface, commands: string[], source: Step['source']) => {
  if (commands.length === 0) return
  const now = await $.clock.now()
  let added = 0
  await update($, steps, list => {
    const known = new Set(list.map(step => step.command))
    const fresh = commands
      .filter(command => !known.has(command))
      .map((command, i): Step => ({ id: `${now}-${i}`, command, source }))
    added = fresh.length
    return [...list, ...fresh].slice(-KEEP)
  })
  if (added === 0) return
  await syncStatus($)
  // unasked, the pane only places itself from 144 columns; it waits otherwise
  void $.ui.open({ id: PANE, title: TITLE })
}

const remove = async ($: EngineInterface, id?: string) => {
  await update($, steps, list => (id === undefined ? [] : list.filter(step => step.id !== id)))
  await syncStatus($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'runbook',
      description: 'Show the commands to run by hand (`/runbook clear` empties it)',
    })
    await syncStatus($)
    return started
  })

  on('command.run', { command: 'runbook' }, async ($, e) => {
    if (e.args.trim() === 'clear') {
      await remove($)
      return { text: 'Runbook cleared.' }
    }
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    return { text: opened.isPlaced ? 'Runbook open.' : `Runbook not placed: ${opened.reason}` }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await add($, fromAnswer(e.answer), 'reply')
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const isBlocked = ran.deny !== undefined || (ran.isError === true && BLOCKED.test(ran.text ?? ''))
    if (isBlocked) await add($, [e.command], 'blocked')
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, steps)

    if (list.length === 0) {
      return <Text dimColor>Nothing to run. Shell blocks Claude hands you and blocked Bash calls land here.</Text>
    }

    return (
      <Box flexDirection="column" rowGap={1}>
        {list.slice(-SHOWN).map(step => (
          <Box flexDirection="column">
            <Text color={step.source === 'blocked' ? 'warning' : 'suggestion'}>
              {step.source === 'blocked' ? 'blocked' : 'to run'}
            </Text>
            <Text>{step.command}</Text>
            <Box flexDirection="row" columnGap={1}>
              <Button
                key={`copy-${step.id}`}
                label="copy"
                onPress={press => void $.ui.copy({ text: step.command, surface: press.surface })}
              />
              <Button
                key={`fill-${step.id}`}
                label="to prompt"
                onPress={() => void $.prompt.fill({ text: `!${step.command}` })}
              />
              <Button key={`done-${step.id}`} label="done" onPress={() => void remove($, step.id)} />
            </Box>
          </Box>
        ))}
        <Box flexDirection="row" columnGap={1}>
          {list.length > SHOWN && <Text dimColor>{list.length - SHOWN} older hidden</Text>}
          <Button key="clear" label="clear all" onPress={() => void remove($)} />
        </Box>
      </Box>
    )
  })
}
