# Testing git-format-staged

This document describes how to run and write tests for git-format-staged.

## Running Tests

### Using Nix (Recommended)

The project uses Nix flakes for reproducible testing across multiple Python versions.

#### Run all tests against all Python versions (3.8 - 3.13):
```bash
nix flake check --print-build-logs
```

#### Run tests manually in development shell:
```bash
# Enter development shell with all dependencies
nix develop

# Run individual test files
cd test
python3 test_piping.py
python3 test_real_formatters.py
```

### Without Nix

If you're not using Nix, ensure you have the required dependencies:
```bash
pip install pathspec pyyaml toml
```

Then run the tests:
```bash
cd test
python3 test_piping.py
python3 test_real_formatters.py
```

## Test Structure

### test_piping.py
Tests the core functionality of git-format-staged, including:
- **Single formatter**: Basic formatting with one command
- **Multiple formatters piping**: Chaining formatters together
- **Pattern matching with exclusions**: Testing gitignore-style patterns
- **Formatter order**: Ensuring formatters run in the correct sequence
- **No-op detection**: Files aren't updated when formatters make no changes
- **Working tree updates**: Changes are applied to working directory
- **Conflict handling**: Graceful handling when patches can't be applied

### test_real_formatters.py
Tests with real-world formatters (if available on system):
- **Prettier + ESLint chain**: JavaScript formatting pipeline
- **Black**: Python code formatting
- **Complex pattern matching**: Tests config file pattern matching with exclusions

## Writing New Tests

Tests use Python's subprocess module to create temporary git repositories and verify behavior.

### Test Template
```python
def test_new_feature():
    """Test description"""
    print("\n=== Test: Feature Name ===")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a git repo
        run_command("git init", cwd=tmpdir)
        run_command("git config user.email 'test@example.com'", cwd=tmpdir)
        run_command("git config user.name 'Test User'", cwd=tmpdir)
        
        # Create initial commit
        add_initial_commit(tmpdir)
        
        # Create test files
        test_file = Path(tmpdir) / "test.txt"
        test_file.write_text("content")
        
        # Stage and format
        run_command("git add test.txt", cwd=tmpdir)
        
        script_path = Path(__file__).parent.parent / "git-format-staged"
        result = run_command(
            f"python3 {script_path} --formatter 'your-formatter' '*'",
            cwd=tmpdir
        )
        
        # Verify results
        staged_content = run_command("git show :test.txt", cwd=tmpdir).stdout
        assert "expected" in staged_content
        
        print("✓ Test passed")
```

### Key Testing Patterns

1. **Always create an initial commit** - Many git commands fail without HEAD
2. **Use relative paths for pattern matching** - Patterns are matched against paths relative to git root
3. **Check both staged and working tree content** - Verify both are updated correctly
4. **Test error conditions** - Ensure graceful failure handling

## Debugging Tests

Run tests with debug output:
```bash
python3 test_piping.py 2>&1 | tee test.log
```

The tests include debug output that shows:
- Commands being executed
- Pattern matching decisions
- Formatter pipeline construction
- File content at each stage

## Continuous Integration

The test suite runs automatically via `nix flake check` and can be integrated into CI systems that support Nix flakes.

## Common Issues

### "No HEAD commit found"
Tests must create an initial commit before staging files:
```python
add_initial_commit(tmpdir)  # Helper function in tests
```

### Pattern matching failures
Remember that patterns use gitignore semantics:
- `*.js` matches all .js files
- `src/**/*.js` matches .js files under src/
- `!vendor/**/*` excludes all files under vendor/ (note the `/*`)

### Formatter not found
Real formatter tests (prettier, black) skip gracefully if the formatter isn't installed:
```python
if run_command("which prettier", check=False).returncode != 0:
    print("⚠️  Prettier not found, skipping test")
    return
```