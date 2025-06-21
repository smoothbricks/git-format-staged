# Breaking Changes in v4.0

## Pattern Matching Behavior Fixed

The most significant change in v4.0 is the fix to pattern matching behavior. The original implementation had critical bugs that made patterns behave unpredictably.

### What Changed

**v3.x and earlier (Broken):**
- Patterns were incorrectly normalized to absolute paths before matching
- Pattern evaluation order affected results in unexpected ways
- `git-format-staged -f fmt '*' '!*.md'` would FORMAT .md files (wrong!)
- `git-format-staged -f fmt '!*.md' '*'` would EXCLUDE .md files (confusing!)

**v4.0 (Fixed):**
- Uses `pathspec` library for proper gitignore-style pattern matching
- Patterns work as documented and expected
- Both `'*' '!*.md'` and `'!*.md' '*'` correctly exclude .md files
- Full support for `**` recursive patterns

### Migration Guide

For most users, no changes are needed. Your patterns will now work correctly:

```bash
# This now works as expected (excludes .md files)
git-format-staged -f prettier '*' '!*.md'
```

If you were relying on the broken behavior (unlikely), you'll need to update your patterns.

## Multiple Formatters Support

v4.0 introduces the ability to apply multiple formatters to the same file in a pipeline:

### What Changed

**v3.x and earlier:**
- Only one formatter could be specified per invocation
- Running multiple formatters required multiple git-format-staged calls

**v4.0:**
- Configuration files can define multiple formatters that run in sequence
- All formatters for a file run in a single efficient pipeline
- Dramatically improved performance for multi-formatter workflows

### Migration Guide

Command-line usage remains unchanged for single formatters. To use multiple formatters, create a configuration file.

## New Dependencies

v4.0 requires Python packages:
- `pathspec` - For correct pattern matching (required)
- `pyyaml` - For YAML config files (optional)
- `toml` - For TOML config files (optional)

Install with: `pip install pathspec pyyaml toml`

## New Features (Non-Breaking)

These additions don't break existing usage:
- Configuration file support (`.git-format-staged.yml`, `.git-format-staged.toml`)
- Multiple formatter pipelines
- Working tree formatting (`--unstaged`, `--also-unstaged`)
- Enhanced debug output (`--debug`)
- Performance improvements

## Unchanged

- Command line interface remains compatible
- Formatter stdin/stdout interface unchanged
- Git object manipulation unchanged
- Working tree patching behavior unchanged