# CLAUDE.md

This file provides guidance to Claude Code when working with the git-format-staged module.

## Development Environment

**ALWAYS use the Nix development shell for running tests and development:**

```bash
# Run tests
nix develop -c npm test

# Run all tests via nix flake check
nix flake check --print-build-logs

# Enter dev shell for interactive work
nix develop
```

The Nix dev shell provides all required dependencies:
- Python 3.x
- pathspec (required)
- pyyaml (for YAML config files)
- toml (for TOML config files)

## Project Overview

git-format-staged v4 is an enhanced fork that fixes critical pattern matching bugs and adds new features:

### Key Features
- **Proper gitignore-style pattern matching** using pathspec library (fixes fnmatch bugs)
- **Configuration file support** (.git-format-staged.yml, .git-format-staged.toml)
- **Multiple formatter pipelines** - chain formatters together
- **Working tree formatting** (--unstaged, --also-unstaged)
- **Enhanced debug output** (--debug)

### Architecture
- Main script: `git-format-staged` (Python 3.8+)
- Helper script: `git-format-all` (runs with --also-unstaged)
- Shell completions in `completions/` directory
- Nix packaging in `flake.nix` and `packages/git-format-staged.nix`

### Testing
- `test/test_piping.py` - Core functionality and piping tests
- `test/test_config_features.py` - Configuration file and validation tests  
- `test/test_real_formatters.py` - Integration tests with real formatters

**Important Testing Guidelines:**
- Config test fixtures should be placed as regular files in `test/fixtures/`
- Use the `loadFixture()` function to load fixture files in tests (see examples in existing tests)
- Do NOT embed YAML/TOML config directly in test strings - use fixture files instead
- This keeps tests cleaner and makes fixture configs reusable across tests

## Important Notes

1. **Version**: This is v4.0.0 (check git tags - v3.1.1 was the last release)
2. **Dependencies**: pathspec is required, yaml/toml are optional but available in nix shell
3. **Pattern Matching**: Uses pathspec.GitIgnoreSpec for correct gitignore semantics
4. **Formatter Piping**: All formatters for a file run in a single pipeline for efficiency

## Common Commands

```bash
# Test pattern matching
nix develop -c python3 git-format-staged --debug --dry-run -f cat '*.js' '!vendor/**'

# Test config file
cat > .git-format-staged.yml << 'EOF'
formatters:
  prettier:
    command: "prettier --stdin-filepath '{}'"
    patterns: ["*.js", "!node_modules/**"]
EOF
nix develop -c python3 git-format-staged --debug

# Run with multiple formatters
nix develop -c python3 git-format-staged --formatter "formatter1" --formatter "formatter2" '*.js'
```

## Known Issues Resolved in v4

1. **Pattern matching bug**: fnmatch converted patterns to absolute paths (FIXED)
2. **Order-dependent patterns**: Pattern order affected results incorrectly (FIXED)  
3. **No config file support**: Had to specify everything on command line (FIXED)
4. **Single formatter limitation**: Couldn't chain formatters (FIXED)
5. **Poor debugging**: Hard to understand pattern matching decisions (FIXED)