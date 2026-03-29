import type { Command } from 'commander'

function detectShell(): string {
  const shell = process.env.SHELL ?? ''
  if (shell.includes('zsh')) return 'zsh'
  return 'bash'
}

const ZSH_COMPLETION = `
#compdef atlas

_atlas() {
  local state

  _arguments \\
    '1: :->command' \\
    '*: :->args'

  case $state in
    command)
      local commands
      commands=(
        'capture:Capture a URL into your knowledge base'
        'list:List all captured entries'
        'show:Show a single entry'
        'search:Search entries by keyword'
        'delete:Delete a captured entry'
        'daemon:Manage the bookmark watcher daemon'
        'providers:Check sync provider status'
        'init:Interactive setup wizard'
        'setup:Alias for init'
        'uninstall:Remove Atlas data and config'
        'completion:Output shell completion script'
      )
      _describe 'command' commands
      ;;
    args)
      case $words[2] in
        daemon)
          local daemon_cmds
          daemon_cmds=(
            'start:Start the daemon in the background'
            'stop:Stop the daemon'
            'status:Show daemon status'
          )
          _describe 'daemon command' daemon_cmds
          ;;
        providers)
          _describe 'providers command' '(status:Show provider sync status)'
          ;;
        completion)
          _describe 'shell' '(bash:Bash completion zsh:Zsh completion)'
          ;;
      esac
      ;;
  esac
}

_atlas "$@"
`.trim()

const BASH_COMPLETION = `
_atlas_completion() {
  local cur
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"

  local top_commands="capture list show search delete daemon providers init setup uninstall completion"

  if [ \$COMP_CWORD -eq 1 ]; then
    COMPREPLY=(\$(compgen -W "\${top_commands}" -- "\${cur}"))
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
    daemon)
      COMPREPLY=(\$(compgen -W "start stop status" -- "\${cur}"))
      ;;
    providers)
      COMPREPLY=(\$(compgen -W "status" -- "\${cur}"))
      ;;
    completion)
      COMPREPLY=(\$(compgen -W "bash zsh" -- "\${cur}"))
      ;;
  esac
}

complete -F _atlas_completion atlas
`.trim()

export function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Output shell completion script')
    .argument('[shell]', 'Shell type: bash or zsh (auto-detected if omitted)')
    .action((shellArg: string | undefined) => {
      const shell = shellArg ?? detectShell()
      if (shell === 'zsh') {
        console.log(ZSH_COMPLETION)
      } else {
        console.log(BASH_COMPLETION)
      }
    })
}
