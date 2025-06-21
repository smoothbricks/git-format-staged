#!/bin/bash
# Bash completion for git-format-staged and git-format-all

_git_format_staged() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    case "$prev" in
        -f|--formatter)
            # No completion for formatter command
            return
            ;;
        --config)
            # Complete with yaml/toml files
            COMPREPLY=($(compgen -f -X '!*.y*ml' -- "$cur"))
            COMPREPLY+=($(compgen -f -X '!*.toml' -- "$cur"))
            return
            ;;
        --files)
            # Complete with all files
            COMPREPLY=($(compgen -f -- "$cur"))
            return
            ;;
    esac
    
    if [[ "$cur" == -* ]]; then
        local opts="--formatter --config --unstaged --also-unstaged --files"
        opts="$opts --no-update-working-tree --no-write --verbose --debug"
        opts="$opts --dry-run --version --help"
        COMPREPLY=($(compgen -W "$opts" -- "$cur"))
    else
        # Complete with files matching patterns from config
        COMPREPLY=($(compgen -f -- "$cur"))
    fi
}

_git_format_all() {
    # Reuse the same completion
    _git_format_staged
}

# Register with git's completion system if available
if type __git_complete &>/dev/null; then
    __git_complete git-format-staged _git_format_staged
    __git_complete git-format-all _git_format_all
fi

# Also register as standalone commands
complete -F _git_format_staged git-format-staged
complete -F _git_format_all git-format-all