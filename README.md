# git-format-staged

[![Build Status](https://travis-ci.org/hallettj/git-format-staged.svg?branch=master)](https://travis-ci.org/hallettj/git-format-staged)

Consider a project where you want all code formatted consistently. So you use
a formatting command. (For example I use [prettier][] in my Javascript and
Typescript projects.) You want to make sure that everyone working on the project
runs the formatter, so you use a tool like [husky][] to install a git pre-commit
hook. The naive way to write that hook would be to:

- get a list of staged files
- run the formatter on those files
- run `git add` to stage the results of formatting

The problem with that solution is it forces you to commit entire files. At
worst this will lead to contributors to unwittingly committing changes. At
best it disrupts workflow for contributors who use `git add -p`.

git-format-staged tackles this problem by running the formatter on the staged
version of the file. Staging changes to a file actually produces a new file
that exists in the git object database. git-format-staged uses some git
plumbing commands to send content from that file to your formatter. The command
replaces file content in the git index. The process bypasses the working tree,
so any unstaged changes are ignored by the formatter, and remain unstaged.

After formatting a staged file git-format-staged computes a patch which it
attempts to apply to the working tree file to keep the working tree in sync
with staged changes. If patching fails you will see a warning message. The
version of the file that is committed will be formatted properly - the warning
just means that working tree copy of the file has been left unformatted. The
patch step can be disabled with the `--no-update-working-tree` option.

[prettier]: https://prettier.io/
[husky]: https://www.npmjs.com/package/husky

## Version 4 Features

git-format-staged v4 introduces several major enhancements:

- **Proper gitignore-style pattern matching**: Uses the `pathspec` library for correct pattern handling
- **Configuration file support**: Define formatters in YAML or TOML files
- **Multiple formatter support**: Apply multiple formatters to the same file in a pipeline
- **Enhanced debugging**: Comprehensive debug output with `--debug`
- **Working tree formatting**: Format unstaged changes with `--unstaged` or `--also-unstaged`
- **Improved performance**: Files are processed once with all matching formatters applied in sequence

## How to install

### Install with Nix

Install via the CLI:

    $ nix profile add github:hallettj/git-format-staged

Or add to your flake imports, and use the `default` package output.

### Install with NPM

Requires Python 3.8 or later, and the `pathspec` library.

Install as a development dependency in a project that uses npm packages:

    $ npm install --save-dev @smoothbricks/git-format-staged

Or install globally:

    $ npm install --global @smoothbricks/git-format-staged

### Or just copy the script

Requires Python 3.8 or later.

If you do not use the above methods you can copy the
[`git-format-staged`](./git-format-staged) script from this repository and
place it in your executable path. The script is MIT-licensed - so you can check
the script into version control in your own open source project if you wish.

Note: You'll need to install the Python `pathspec` library:

    $ pip install pathspec pyyaml toml

## How to use

For detailed information run:

    $ git-format-staged --help

### Command Line Usage

The command expects a shell command to run a formatter, and one or more file
patterns to identify which files should be formatted. For example:

    $ git-format-staged --formatter 'prettier --stdin-filepath "{}"' 'src/*.js'

That will format all files under `src/` and its subdirectories using
`prettier`. The file patterns use gitignore-style matching via the `pathspec`
library.

### Configuration Files

git-format-staged v4 supports configuration files in YAML or TOML format. Create
a `.git-format-staged.yml` or `.git-format-staged.toml` file in your project
root:

#### YAML Example (.git-format-staged.yml)

```yaml
formatters:
  prettier:
    command: "prettier --stdin-filepath '{}'"
    patterns:
      - "*.js"
      - "*.jsx"
      - "*.ts"
      - "*.tsx"
      - "!node_modules/**"
      - "!dist/**"
  
  eslint-fix:
    command: "eslint --fix --stdin --stdin-filename '{}'"
    patterns:
      - "*.js"
      - "*.jsx"
      - "!*.test.js"

  black:
    command: "black -"
    patterns:
      - "*.py"
      - "!venv/**"

settings:
  update_working_tree: true
  show_commands: false
```

#### TOML Example (.git-format-staged.toml)

```toml
version = 1
debug = false

[formatters.prettier]
command = "prettier --stdin-filepath '{}'"
patterns = [
  "*.js",
  "*.jsx", 
  "*.ts",
  "*.tsx",
  "!node_modules/**",
  "!dist/**"
]

[formatters.black]
command = "black -"
patterns = [
  "*.py",
  "!venv/**",
  "!.venv/**"
]

[settings]
update_working_tree = true
show_commands = false
```

With a configuration file, you can simply run:

    $ git-format-staged

### Multiple Formatters

When multiple formatters match the same file, they are applied in sequence as
a pipeline. The output of one formatter becomes the input of the next:

```yaml
formatters:
  # First, format with prettier
  prettier:
    command: "prettier --stdin-filepath '{}'"
    patterns: ["*.js"]
  
  # Then run eslint --fix
  eslint-fix:
    command: "eslint --fix --stdin --stdin-filename '{}'"
    patterns: ["*.js"]
```

### Pattern Sets and Inheritance

You can define reusable pattern sets and use `extends` to inherit patterns:

```yaml
# Define reusable pattern sets
pattern_sets:
  common:
    - "src/**/*.js"
    - "src/**/*.ts"
    - "!node_modules/**"
    - "!dist/**"
  
  tests:
    - "test/**/*.js"
    - "test/**/*.spec.ts"
    - "!test/fixtures/**"

formatters:
  prettier:
    command: "prettier --stdin-filepath '{}'"
    extends: [common, tests]  # Inherit from multiple sets
    patterns:  # Additional patterns
      - "*.json"
      - "*.yml"
  
  eslint:
    command: "eslint --fix --stdin --stdin-filename '{}'"
    extends: common  # Single inheritance
    patterns:
      - "test/**/*.js"  # Add more patterns
```

The same works in TOML:

```toml
[pattern_sets]
common = [
  "src/**/*.js",
  "src/**/*.ts", 
  "!node_modules/**",
  "!dist/**"
]

tests = [
  "test/**/*.js",
  "test/**/*.spec.ts",
  "!test/fixtures/**"
]

[formatters.prettier]
command = "prettier --stdin-filepath '{}'"
extends = ["common", "tests"]
patterns = ["*.json", "*.yml"]
```

When using `extends`:
- Patterns from all extended sets are merged in order
- Additional patterns in the formatter are appended
- All patterns are flattened into a single list

### YAML Anchors and Pattern Sets

Both YAML anchors and pattern sets can be used for pattern reuse, but they work differently:

#### YAML Anchors (YAML only)
```yaml
# Define patterns with YAML anchor
common_patterns: &common
  - "*.js"
  - "*.ts"
  - "!node_modules/**"

formatters:
  # Direct alias reference - replaces entire patterns list
  formatter1:
    command: "prettier --stdin-filepath '{}'"
    patterns: *common
  
  # Anchor in list - creates nested list (automatically flattened)
  formatter2:
    command: "eslint --fix-dry-run --stdin --stdin-filename '{}'"
    patterns:
      - *common      # Flattened automatically
      - "*.json"     # Additional patterns
```

#### Pattern Sets vs YAML Anchors
- **Pattern Sets**: Work in both YAML and TOML, designed for pattern inheritance
- **YAML Anchors**: YAML-only feature, more flexible but can be confusing with lists
- **Glob patterns**: Patterns like `*myfile` or `!*test*` are treated as glob patterns, not YAML aliases (unless a matching anchor exists)

#### Special Characters in Patterns
Patterns starting with `*`, `!`, `&`, etc. are automatically handled:
- If a pattern like `*common` has a matching anchor `&common`, it's treated as a YAML alias
- Otherwise, it's treated as a glob pattern (e.g., `*myfile` matches files ending with "myfile")
- No manual quoting needed - the tool handles this automatically

### Pattern Matching

Patterns use gitignore-style syntax:
- `*.js` matches all .js files recursively
- `src/**/*.js` matches .js files under src/
- `!vendor/**` excludes all files under vendor/
- `*.test.js` matches test files
- `!*.test.js` excludes test files

Files can be excluded by prefixing a pattern with `!`. Patterns are evaluated
in order: if a file matches multiple patterns, all matching patterns are
considered, with exclusions taking precedence.

### Working Tree Formatting

Format unstaged changes instead of staged changes:

    $ git-format-staged --unstaged --formatter 'black -' '*.py'

Format both staged and unstaged changes:

    $ git-format-staged --also-unstaged --formatter 'prettier --stdin-filepath "{}"' '*.js'

### Debugging

Use `--debug` to see detailed information about pattern matching and formatter
execution:

    $ git-format-staged --debug

## Breaking Changes in v4

### Pattern Matching
- **Old behavior**: Used Python's `fnmatch` which had bugs with absolute path conversion
- **New behavior**: Uses `pathspec` library for proper gitignore-style matching
- **Migration**: Patterns should work the same, but edge cases are now handled correctly

### Multiple Formatters
- **Old behavior**: Only one formatter could be specified
- **New behavior**: Config files can define multiple formatters that run in sequence
- **Migration**: Command-line usage remains the same for single formatters

### Configuration Files
- **New feature**: YAML/TOML config files are now supported
- **Migration**: Not required - command-line usage still works

### Performance
- **Old behavior**: Each formatter was run separately for each file
- **New behavior**: All formatters for a file run in a single pipeline
- **Impact**: Significantly faster when using multiple formatters

## Set up a pre-commit hook with Husky

Follow these steps to automatically format all Javascript files on commit in
a project that uses npm.

Install git-format-staged, husky, and a formatter (I use `prettier`):

    $ npm install --save-dev @smoothbricks/git-format-staged husky prettier

Add a `prepare` script to install husky when running `npm install`:

    $ npm set-script prepare "husky install"
    $ npm run prepare

Add the pre-commit hook:

    $ npx husky add .husky/pre-commit "git-format-staged --formatter 'prettier --stdin-filepath \"{}\"' '*.js' '*.ts'"
    $ git add .husky/pre-commit

Once again note that the formatter command and the `'*.js'` and `'*.ts'`
patterns are quoted!

That's it! Whenever a file is changed as a result of formatting on commit you
will see a message in the output from `git commit`.

## Comparisons to similar utilities

There are other tools that will format or lint staged files. What distinguishes
git-format-staged is that when a file has both staged and unstaged changes
git-format-staged ignores the unstaged changes; and it leaves unstaged changes
unstaged when applying formatting.

Some linters (such as [precise-commits][]) have an option to restrict linting
to certain lines or character ranges in files, which is one way to ignore
unstaged changes while linting. The author is not aware of a utility other than
git-format-staged that can apply any arbitrary linter so that it ignores
unstaged changes.

Some other formatting utilities (such as [pre-commit][])
use a different strategy to keep unstaged changes unstaged:

1. stash unstaged changes
2. apply the formatter to working tree files
3. stage any resulting changes
4. reapply stashed changes to the working tree.

The problem is that you may get a conflict where stashed changes cannot be
automatically merged after formatting has been applied. In those cases the user
has to do some manual fixing to retrieve unstaged changes. As far as the author
is aware git-format-staged is the only utility that applies a formatter without
touching working tree files, and then merges formatting changes to the working
tree. The advantage of merging formatting changes into unstaged changes (as
opposed to merging unstaged changes into formatting changes) is that
git-format-staged is non-lossy: if there are conflicts between unstaged changes
and formatting the unstaged changes win, and are kept in the working tree,
while staged/committed files are formatted properly.

Another advantage of git-format-staged is that it has no dependencies beyond
Python and git, and can be dropped into any programming language ecosystem.

Some more comparisons:

- [lint-staged][] lints and formats staged files. At the time of this writing
  it does not have an official strategy for ignoring unstaged changes when
  linting, or for keeping unstaged changes unstaged when formatting. But
  lint-staged does provide powerful configuration options around which files
  should be linted or formatted, what should happen before and after linting,
  and so on.
- [pretty-quick][] formats staged files with prettier. By default pretty-quick
  will abort the commit if files are partially staged to allow the user to
  decide how to re-stage changes from formatting. The result is more manual
  effort compared to git-format-staged.
- the one-liner
  `git diff --diff-filter=d --cached | grep '^[+-]' | grep -Ev '^(--- a/|\+\+\+ b/)' | LINT_COMMAND`
  (described [here][lint changed hunks]) extracts changed hunks and feeds them
  to a linter. But linting will fail if the linter requires the entire file for
  context. For example a linter might report errors if it cannot see import
  lines.

[precise-commits]: https://github.com/nrwl/precise-commits
[pre-commit]: https://pre-commit.com/#pre-commit-during-commits
[pretty-quick]: https://www.npmjs.com/package/pretty-quick
[lint-staged]: https://github.com/okonet/lint-staged
[lint changed hunks]: https://github.com/okonet/lint-staged/issues/62#issuecomment-383217916