# Completions for git-format-staged
complete -c git-format-staged -s f -l formatter -d "Formatter command" -x
complete -c git-format-staged -l config -d "Config file" -r -F -a "*.yml *.yaml *.toml"
complete -c git-format-staged -l unstaged -d "Format only unstaged changes"
complete -c git-format-staged -l also-unstaged -d "Format both staged and unstaged"
complete -c git-format-staged -l files -d "Format specific files" -r -F
complete -c git-format-staged -l no-update-working-tree -d "Don't update working tree"
complete -c git-format-staged -l no-write -d "Dry run, don't modify files"
complete -c git-format-staged -s v -l verbose -d "Show formatting commands"
complete -c git-format-staged -l debug -d "Show detailed debug output"
complete -c git-format-staged -l dry-run -d "Preview what would be formatted"
complete -c git-format-staged -l version -d "Show version"
complete -c git-format-staged -l help -d "Show help"

# Completions for git-format-all (wraps git-format-staged)
complete -c git-format-all -w git-format-staged