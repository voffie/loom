# Comprehensive Test Suite Plan for Loom

## Overview

This document outlines a complete test suite for loom, a modern dotfiles manager built with TypeScript and the Effect ecosystem. The test suite uses @effect/vitest for Effect-native testing, property-based testing with Effect's FastCheck integration, and follows Effect's functional testing patterns.

## Architecture Understanding

### Core Modules
- **Commands**: init, install, link, prune, remove, unlink, update
- **Utils**: config (TOML), fs (file system ops), git (git operations), exec (command execution), logger (colored output), reporting (operation counting)
- **Types**: LoomConfig, LoomConfigEntry with Effect Schema validation  
- **Errors**: Tagged errors for all failure cases

### Key Dependencies
- Effect ecosystem (@effect/cli, @effect/platform-node)
- TOML parsing (@iarna/toml)
- Node.js file system operations
- Git command integration

## Test Structure

```
src/
├── __tests__/
│   ├── setup.ts                    # Test setup and utilities
│   ├── fixtures/                   # Test data and fixtures
│   │   ├── configs/               # Sample TOML configs
│   │   │   ├── valid-basic.toml
│   │   │   ├── valid-complex.toml
│   │   │   ├── invalid-malformed.toml
│   │   │   └── empty.toml
│   │   └── schemas.ts             # Test data generators & arbitraries
│   ├── utils/                     # Utility module tests
│   │   ├── config.test.ts
│   │   ├── fs.test.ts
│   │   ├── git.test.ts
│   │   ├── exec.test.ts
│   │   ├── logger.test.ts
│   │   └── reporting.test.ts
│   ├── commands/                  # Command module tests
│   │   ├── init.test.ts
│   │   ├── install.test.ts
│   │   ├── link.test.ts
│   │   ├── remove.test.ts
│   │   ├── unlink.test.ts
│   │   ├── update.test.ts
│   │   └── prune.test.ts
│   ├── types/                     # Schema and type tests
│   │   └── index.test.ts
│   ├── errors/                    # Error handling tests
│   │   └── index.test.ts
│   └── integration/               # Full workflow tests
│       └── workflows.test.ts
```

## Detailed Test Specifications

### 1. Schema & Types Testing (`src/__tests__/types/index.test.ts`)

#### Property-Based Tests
- **LoomConfigEntry validation**: Generate random config entries and ensure they validate correctly
- **LoomConfig structure**: Test nested config structures with multiple entries
- **Schema roundtrip properties**: Ensure `encode(decode(x)) === x` for valid data
- **Invalid data rejection**: Property tests for malformed data rejection

#### Implementation Strategy
```typescript
// Custom arbitraries for realistic config generation
const ConfigEntryArbitrary = Schema.Record({
  key: Schema.String,
  value: Schema.Struct({
    source: Schema.optional(Schema.String.pipe(Schema.pattern(/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/))),
    target: Schema.String.pipe(Schema.startsWith('/'))
  })
})

// Property tests
it.prop('config roundtrip property', [ConfigEntryArbitrary], ([config]) => ...)
```

### 2. Utils Module Tests

#### Config Utils (`src/__tests__/utils/config.test.ts`)

**Core Functions to Test:**
- `readConfig()` - TOML parsing and validation
- `writeEntry()` - Adding entries with conflict resolution
- `removeEntry()` - Entry removal

**Test Cases:**
- **Valid TOML files**: Various config structures
- **Malformed TOML**: Error handling for invalid syntax
- **Missing config file**: Proper error messaging
- **User interaction**: Mocked prompt responses for overrides
- **File permissions**: Read/write permission errors
- **Concurrent access**: Multiple config operations

**Property Tests:**
- Config operations maintain TOML validity
- Entry names are properly sanitized
- Path resolution is consistent

#### File System Utils (`src/__tests__/utils/fs.test.ts`)

**Security-Critical Tests:**
- **Path traversal prevention**: Test `removeDotfileEntry()` with malicious paths
- **Directory escaping**: Ensure operations stay within dotfiles root
- **Symlink validation**: Verify symlink targets are legitimate

**Core Operations:**
- `pathExists()` - Path validation and checking
- `symlinkEntry()` / `unlinkEntry()` - Symlink management
- `getDotfilesEntries()` - Directory listing
- `addLocalEntry()` - File moving operations
- `removeDotfileEntry()` - Safe deletion with path validation

**Property Tests:**
- All generated paths stay within dotfiles directory
- Symlink operations are idempotent
- File operations maintain file system consistency

#### Git Utils (`src/__tests__/utils/git.test.ts`)

**Validation Tests:**
- GitHub URL format validation (`username/repo`)
- Git availability checking
- Command construction for cloning

**Property Tests:**
- All valid GitHub patterns pass validation
- Invalid patterns are rejected consistently
- URL encoding is handled properly

#### Exec Utils (`src/__tests__/utils/exec.test.ts`)

**Command Execution:**
- Successful command execution
- Error handling for failed commands
- Timeout scenarios
- Command output capture

#### Logger Utils (`src/__tests__/utils/logger.test.ts`)

**Formatting Tests:**
- Color code application
- Text styling (bold, etc.)
- Message formatting consistency

#### Reporting Utils (`src/__tests__/utils/reporting.test.ts`)

**Operation Tracking:**
- Counter increment functionality  
- Summary generation
- Multi-operation reporting
- Report formatting

### 3. Command Testing

#### Init Command (`src/__tests__/commands/init.test.ts`)

**Initialization Scenarios:**
- Fresh initialization (create directory + config)
- Skip existing setup (directory/config already exists)
- Permission errors during directory creation
- File creation failures
- ASCII art display

**Property Tests:**
- Various home directory paths work correctly
- Directory creation is idempotent

#### Install Command (`src/__tests__/commands/install.test.ts`)

**Local Source Installation:**
- Moving local files to dotfiles directory
- Path validation and resolution
- User override scenarios (existing entries)
- Invalid local paths

**Git Repository Installation:**
- GitHub URL validation
- Mocked git clone operations
- Git availability checking
- Clone failure scenarios
- Override existing git repos

**Property Tests:**
- Source/target path combinations are valid
- Installation operations are atomic (succeed completely or fail safely)

#### Link Command (`src/__tests__/commands/link.test.ts`)

**Symlink Management:**
- Creating symlinks from config entries
- Handling existing symlinks (removal + recreation)
- Missing source dotfiles
- Invalid target paths
- Batch operation reporting

**Property Tests:**
- Link operations maintain config consistency
- Symlink creation is idempotent
- Batch operations handle mixed success/failure correctly

#### Remove Command (`src/__tests__/commands/remove.test.ts`)

**Entry Removal:**
- Removing config entries
- Cleaning up dotfiles from disk
- Handling non-existent entries
- Partial failure scenarios (config vs. disk cleanup)

#### Additional Commands (Unlink, Update, Prune)
- Similar patterns with command-specific logic
- Error handling and recovery
- User interaction scenarios

### 4. Property-Based Testing Scenarios

#### Configuration Properties
```typescript
// Roundtrip property
it.prop('config serialization roundtrip', [LoomConfigSchema], ([config]) =>
  Effect.gen(function* () {
    const serialized = TOML.stringify(config)
    const parsed = TOML.parse(serialized)
    const decoded = yield* Schema.decodeUnknown(LoomConfigSchema)(parsed)
    yield* Effect.sync(() => expect(decoded).toEqual(config))
  })
)

// Entry consistency
it.prop('entries have required fields', [LoomConfigEntrySchema], ([entry]) =>
  Effect.gen(function* () {
    yield* Effect.sync(() => {
      expect(typeof entry.target).toBe('string')
      expect(entry.target.length).toBeGreaterThan(0)
    })
  })
)
```

#### File System Properties
```typescript
// Path security property
it.prop('paths cannot escape dotfiles root', [Schema.String], ([userPath]) =>
  Effect.gen(function* () {
    const result = yield* removeDotfileEntry(userPath).pipe(Effect.either)
    if (userPath.includes('..') || userPath.startsWith('/')) {
      yield* Effect.sync(() => expect(Either.isLeft(result)).toBe(true))
    }
  })
)
```

#### Command Properties
```typescript
// Install/Remove reversibility
it.prop('install then remove leaves no traces', [Schema.String, Schema.String], ([source, name]) =>
  Effect.gen(function* () {
    // Initial state
    const initialConfig = yield* readConfig()
    
    // Install then remove
    yield* installCommand(source, name)
    yield* removeCommand(name)
    
    // Verify state restoration
    const finalConfig = yield* readConfig()
    yield* Effect.sync(() => expect(finalConfig).toEqual(initialConfig))
  })
)
```

### 5. Integration Testing (`src/__tests__/integration/workflows.test.ts`)

#### Complete Workflows
- **Fresh setup**: `init -> install -> link -> remove`
- **Git workflow**: `install github-repo -> link -> update -> unlink`
- **Local workflow**: `install local-files -> link -> modify -> link`
- **Error recovery**: Simulate failures at each workflow step
- **Concurrent operations**: Multiple parallel installs/links

#### Cross-Command Integration
- Config consistency across command chains
- File system state management
- Error propagation and recovery
- User interaction flows

### 6. Test Service Implementations

#### Mock Services Layer Architecture
```typescript
// File System Mock
const TestFileSystem = Layer.succeed(FileSystemService, {
  readFile: (path) => Effect.succeed(mockFileContents.get(path)),
  writeFile: (path, content) => Effect.sync(() => mockFileContents.set(path, content)),
  // ... other operations
})

// Git Service Mock  
const TestGitService = Layer.succeed(GitService, {
  clone: (url, target) => Effect.succeed(undefined),
  isAvailable: () => Effect.succeed(true)
})

// Prompt Service Mock
const TestPromptService = Layer.succeed(PromptService, {
  select: (options) => Effect.succeed(mockUserChoice)
})
```

#### Test Data Management
```typescript
// Fixture management
const createTestFixture = (name: string) => Effect.gen(function* () {
  const tempDir = yield* createTempDirectory()
  const configPath = path.join(tempDir, 'loom.toml')
  const fixture = fixtures[name]
  yield* writeFile(configPath, fixture.content)
  return { tempDir, configPath, expected: fixture.expected }
})
```

### 7. Error Testing Strategy

#### Comprehensive Error Coverage
- **All tagged errors**: Individual tests for each error type
- **Error propagation**: Verify errors bubble up correctly
- **Recovery scenarios**: Test graceful degradation
- **User-friendly messages**: Validate error message quality
- **Error context**: Ensure errors include relevant debugging info

#### Error Scenarios Matrix
```typescript
const errorScenarios = [
  { error: 'ReadFileError', triggers: ['missing file', 'permission denied'] },
  { error: 'WriteFileError', triggers: ['permission denied', 'disk full'] },
  { error: 'ValidationError', triggers: ['invalid format', 'missing fields'] },
  // ... etc
]
```

### 8. Test Data Generation Strategy

#### Custom Arbitraries with Faker.js Integration
```typescript
// Realistic path generation
const PathArbitrary = Schema.String.annotations({
  arbitrary: () => (fc) => fc.tuple(
    fc.constantFrom('nvim', 'tmux', 'zsh', 'git'),
    fc.constant(faker.system.directoryPath())
  ).map(([name, base]) => path.join(base, name))
})

// GitHub URL generation
const GitHubUrlArbitrary = Schema.String.annotations({
  arbitrary: () => (fc) => fc.tuple(
    fc.stringMatching(/^[a-zA-Z0-9-_.]{3,20}$/),
    fc.stringMatching(/^[a-zA-Z0-9-_.]{3,50}$/)
  ).map(([user, repo]) => `${user}/${repo}`)
})
```

## Implementation Guidelines

### Key Testing Patterns
1. **it.layer()** - Dependency injection with test services
2. **it.effect()** - Effect-native testing
3. **it.scoped()** - Resource management testing
4. **it.prop()** - Property-based testing
5. **TestClock** - Time-dependent operations

### Mock Strategy Principles
- **Layered architecture**: Clean separation of concerns
- **Realistic behavior**: Mocks should behave like real services
- **Error simulation**: Easy failure injection for testing
- **State management**: Proper isolation between tests

### Coverage Goals
- **100% line coverage** for all utility functions
- **All error paths** explicitly tested
- **All command workflows** covered end-to-end
- **Property invariants** verified with diverse inputs
- **Integration scenarios** validated

### Test Organization Best Practices
- **Descriptive test names**: Clear intent and expectations
- **Logical grouping**: Related tests grouped in describe blocks
- **Setup/teardown**: Clean test isolation
- **Assertion clarity**: Meaningful error messages
- **Performance consideration**: Fast test execution

## Execution Strategy

### Phase 1: Foundation
1. Test infrastructure setup
2. Mock services and fixtures
3. Schema and type tests
4. Core utility tests

### Phase 2: Commands
1. Individual command tests
2. Error scenario coverage
3. User interaction testing
4. Property test implementation

### Phase 3: Integration
1. Workflow integration tests
2. Cross-command interactions
3. Performance and concurrency tests
4. Final coverage verification

This comprehensive test suite ensures loom's reliability, security, and maintainability while leveraging Effect's powerful testing capabilities for robust, functional testing patterns.