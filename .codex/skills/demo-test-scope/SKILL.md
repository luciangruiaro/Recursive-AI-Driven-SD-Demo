---
name: demo-test-scope
description: Assess, create, or enhance tests for a named code area following TDD patterns. Inventories functions, finds existing tests, identifies gaps, and writes new tests in the project's mirror test directory. Use when adding coverage to a module or before refactoring.
argument-hint: <path or component description>
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent
user_invocable: true
---

# Test Scope

Assess test coverage for a code area, then create or enhance tests
as needed.

## Context Loading

Read any project rule file that pins testing standards (commonly
`.claude/rules/testing-standards.mdc`, `CONTRIBUTING.md`, or a
`docs/testing.md`) to understand:
- TDD workflow (write failing test first, implement minimum, run
  suite)
- Test file organization (most projects mirror the `tests/`
  directory structure to the source tree)
- Fixture patterns and naming conventions
- Available test commands (the project's test runner — `pytest`,
  `vitest`, `jest`, `dotnet test`, `go test`, etc.)

If no testing rule file exists, infer the convention from the
existing test layout — find one example test file and mirror its
shape.

## Scope Resolution

Parse `$ARGUMENTS` to determine what to test:

1. **Path given** (e.g., `src/services/scheduler/`):
   - Glob for all source files under that path (`.py`, `.ts`,
     `.tsx`, `.cs`, etc.)
   - Identify the mirror test directory (e.g.,
     `tests/services/scheduler/`)

2. **Component name** (e.g., "the cache layer"):
   - Grep the codebase to locate the component
   - Identify the source file(s) and their test mirror

3. **"uncommitted"** or empty:
   - Run `git diff --name-only HEAD` to find changed files
   - Focus on those files' tests

## Analysis Phase

For each source file in scope:

### 1. Inventory Functions

Read the source and list every public function/method:
```
module.<ext>:
  - class Foo:
    - __init__(self, ...)
    - do_work(self, x, y) -> str    [TESTED]
    - handle_error(self, e)         [UNTESTED]
  - helper_func(a, b)               [UNTESTED]
```

### 2. Find Existing Tests

Check the mirror test path. For each test file:
- List test classes and methods
- Map each test to the source function it covers
- Identify source functions with NO corresponding test

### 3. Assess Quality

For existing tests, check:
- Are assertions meaningful (not just `assert True`)?
- Are edge cases covered (empty input, null/None, boundary
  values)?
- Are error paths tested (raises / throws / error returns)?
- Are mocks appropriate (not over-mocking implementation
  details)?

## Action Phase

### For untested functions:

Write tests following the project pattern. Generic shape (adapt
to the project's language and test runner):

```
class TestFunctionName:
    def test_happy_path(self):
        """GIVEN valid input WHEN function called THEN expected output."""
        ...

    def test_edge_case(self):
        """GIVEN edge input WHEN function called THEN handles gracefully."""
        ...

    def test_error_case(self):
        """GIVEN invalid input WHEN function called THEN raises/returns error."""
        ...
```

### For weak existing tests:

Add missing edge cases, strengthen assertions, remove redundant
tests.

### Rules

- **Do NOT mock** internal implementation details — mock external
  boundaries only (HTTP calls, database, file I/O, third-party
  service calls)
- **Do NOT add** tests for trivial getters/setters or constructors
  unless they contain logic
- Use shared fixtures from the project's fixture/conftest files
  rather than re-defining
- Put tests in the mirror directory: source `<src>/X/Y.<ext>` →
  test `tests/X/Y/test_Y.<ext>` (or whatever shape the project
  uses)

## Verification

After writing/editing tests:

```bash
# Run just the scope's tests (using whatever runner the project uses)
<test-runner> <test_directory> -v
```

If any fail, fix the test (not the source!) unless the source has
a real bug.

## Report

Output a summary:

```
## Test Coverage Report for <scope>

| Source File | Functions | Tested | Added | Enhanced |
|-------------|-----------|--------|-------|----------|
| foo.<ext>   | 5         | 3      | 2     | 0        |
| bar.<ext>   | 3         | 3      | 0     | 1        |

**New tests written:** 2
**Existing tests enhanced:** 1
**All tests passing:** Yes
```

## Anti-patterns

- ❌ **Mocking the system under test.** Mock external boundaries,
  not internal helpers.
- ❌ **`assert True` / `assert result is not None` as the only
  assertion.** Be specific about what the result should be.
- ❌ **One mega-test that exercises five concerns.** Split.
- ❌ **Skipping the failure paths.** A function with no error-path
  test is half-tested.
- ❌ **Writing tests for code that should be deleted.** If the
  function is dead code, remove it instead.
- ❌ **Adding tests in a sibling directory rather than the mirror
  one.** Future maintainers won't find them.
