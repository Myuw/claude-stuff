// expiresAt/checkedAt in ms since epoch; ssoExpiresAt null when no cached SSO token
export type Host = { ssoExpiresAt: number | null; checkedAt: number; repo: string; branch: string }
export type Cluster = { name: string; account: string; region: string }

declare module 'claude-code' {
  interface PluginState {
    'infra-context': { host: Host | null; cluster: Cluster | null; tofu: string | null }
  }
}
