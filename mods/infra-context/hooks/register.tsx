import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cluster, Host } from '../types'

const host = atom({ plugin: 'infra-context', key: 'host' } as const, null)
const cluster = atom({ plugin: 'infra-context', key: 'cluster' } as const, null)
const tofu = atom({ plugin: 'infra-context', key: 'tofu' } as const, null)

// `. ~/.eks-claude.sh <account> <region> <cluster>` (or ~/.eks.sh)
const EKS = /eks(?:-claude)?\.sh\s+(\S+)\s+(\S+)\s+(\S+)/
const TOFU = /TOFU_PROJECT_NAME=["']?([^"'\s]+)/
const PROD = /prod/i
const SSO_LOGIN = 'aws sso login --profile eks'
const WARN_MS = 30 * 60_000

// Latest expiresAt among cached SSO tokens; only the date is kept, never the token
const ssoExpiry = async ($: EngineInterface): Promise<number | null> => {
  const home = await $.env.get('HOME')
  const dir = `${home}/.aws/sso/cache`
  const entries = await $.fs.list(dir).catch(() => [])
  let latest: number | null = null
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    const text = await $.fs.read(`${dir}/${entry.name}`).catch(() => '')
    let cached: { accessToken?: string; expiresAt?: string } = {}
    try {
      cached = JSON.parse(text)
    } catch {
      continue
    }
    // client registrations carry expiresAt too; token files alone have accessToken
    if (!cached.accessToken || !cached.expiresAt) continue
    const at = Date.parse(cached.expiresAt)
    if (!Number.isNaN(at) && (latest === null || at > latest)) latest = at
  }
  return latest
}

const gitHead = async ($: EngineInterface) => {
  const root = await $.session.root()
  const head = await $.fs.read(`${root}/.git/HEAD`).catch(() => '')
  const branch = head.startsWith('ref: refs/heads/')
    ? head.slice('ref: refs/heads/'.length).trim()
    : head.trim().slice(0, 8)
  return { repo: root.split('/').pop() ?? root, branch }
}

const refresh = async ($: EngineInterface) => {
  const [ssoExpiresAt, git, checkedAt] = await Promise.all([ssoExpiry($), gitHead($), $.clock.now()])
  const next: Host = { ssoExpiresAt, checkedAt, ...git }
  await update($, host, () => next)
}

const noteTarget = async ($: EngineInterface, text: string) => {
  const [, account, region, name] = EKS.exec(text) ?? []
  if (account && region && name) {
    const target: Cluster = { account, region, name }
    await update($, cluster, () => target)
  }
  const [, project] = TOFU.exec(text) ?? []
  if (project) await update($, tofu, () => project)
}

const duration = (ms: number) => {
  const minutes = Math.floor(ms / 60_000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}` : `${minutes}m`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await refresh($)
    $.clock.every(60_000, () => void refresh($))
    return started
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await refresh($)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    await noteTarget($, e.command)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await noteTarget($, e.text)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [known, target, project] = await Promise.all([read($, host), read($, cluster), read($, tofu)])
    if (e.props.hasSurvey || known === null) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const left = known.ssoExpiresAt === null ? null : known.ssoExpiresAt - known.checkedAt
    const isExpired = left === null || left <= 0
    const ssoColor = isExpired ? 'error' : left < WARN_MS ? 'warning' : 'success'
    const isProd = (target !== null && PROD.test(target.name)) || (project !== null && PROD.test(project))

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text color={ssoColor}>SSO {left === null ? 'none' : isExpired ? 'expired' : duration(left)}</Text>
        {isExpired && (
          <Button
            key="login"
            label="copy login"
            onPress={press => void $.ui.copy({ text: SSO_LOGIN, surface: press.surface })}
          />
        )}
        <Text dimColor>·</Text>
        <Text color={isProd ? 'error' : undefined} weight={isProd ? 'bold' : undefined}>
          ⎈ {target === null ? 'no cluster yet' : `${target.name} (${target.account}/${target.region})`}
        </Text>
        {project !== null && (
          <>
            <Text dimColor>·</Text>
            <Text color={PROD.test(project) ? 'error' : undefined}>tofu {project}</Text>
          </>
        )}
        <Text dimColor>·</Text>
        <Text dimColor>
          {known.repo}@{known.branch}
        </Text>
      </Box>
    )
  })
}
