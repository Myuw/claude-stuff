// reply: a shell block in Claude's answer; blocked: a Bash call a guard or deny rule refused
export type Step = { id: string; command: string; source: 'reply' | 'blocked' }

declare module 'claude-code' {
  interface PluginState {
    'run-by-hand': { steps: Shaped<Step[]> }
  }
}
