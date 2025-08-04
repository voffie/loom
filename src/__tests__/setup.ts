import { describe, it, expect } from '@effect/vitest'
import { Effect, Context, Layer, Ref } from 'effect'
import { Prompt } from '@effect/cli'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

// Export the enhanced testing utilities
export { describe, it, expect }

// Test configuration
export const TEST_CONFIG = {
  timeout: 30000,
  fastCheck: {
    numRuns: 100,
    maxSkipsPerRun: 50,
    seed: 42,
    verbose: false
  }
}

// Mock File System Service interface
export interface MockFileSystemService {
  readonly files: Ref.Ref<Map<string, string>>
  readonly directories: Ref.Ref<Set<string>>
  readonly symlinks: Ref.Ref<Map<string, string>>
  readonly readFile: (path: string) => Effect.Effect<string, { _tag: 'ReadFileError', path: string, cause: unknown }>
  readonly writeFile: (path: string, content: string) => Effect.Effect<void, { _tag: 'WriteFileError', path: string, cause: unknown }>
  readonly exists: (path: string) => Effect.Effect<boolean>
  readonly mkdir: (path: string) => Effect.Effect<void, { _tag: 'MakeDirectoryError', path: string, cause: unknown }>
  readonly symlink: (target: string, linkPath: string) => Effect.Effect<void, { _tag: 'SymlinkError', pointer: string, symlink: string, cause: unknown }>
  readonly unlink: (path: string) => Effect.Effect<void, { _tag: 'UnlinkError', symlink: string, cause: unknown }>
  readonly readdir: (path: string) => Effect.Effect<string[], { _tag: 'ReadDirectoriesError', path: string, cause: unknown }>
  readonly rm: (path: string, options?: { recursive?: boolean, force?: boolean }) => Effect.Effect<void, { _tag: 'RemoveEntryError', path: string, cause: unknown }>
  readonly lstat: (path: string) => Effect.Effect<{ isSymbolicLink: () => boolean }, { _tag: 'StatError', path: string, cause: unknown }>
  readonly rename: (oldPath: string, newPath: string) => Effect.Effect<void, { _tag: 'MoveEntryError', from: string, to: string, cause: unknown }>
  readonly reset: () => Effect.Effect<void>
}

export class MockFileSystemService extends Context.Tag('MockFileSystemService')<
  MockFileSystemService,
  MockFileSystemService
>() {
  static readonly Live = Layer.succeed(
    MockFileSystemService,
    // @ts-expect-error - Complex nested Effect types cause inference issues but the implementation is correct
    Effect.gen(function* () {
      const files = yield* Ref.make(new Map<string, string>())
      const directories = yield* Ref.make(new Set<string>(['/']))
      const symlinks = yield* Ref.make(new Map<string, string>())

      return {
        files,
        directories,
        symlinks,

        readFile: (filePath: string) =>
          Effect.gen(function* () {
            const fileMap = yield* Ref.get(files)
            const content = fileMap.get(filePath)
            if (content === undefined) {
              return yield* Effect.fail({
                _tag: 'ReadFileError' as const,
                path: filePath,
                cause: 'File not found'
              })
            }
            return content
          }),

        writeFile: (filePath: string, content: string) =>
          Effect.gen(function* () {
            const fileMap = yield* Ref.get(files)
            const dirSet = yield* Ref.get(directories)
            const dir = path.dirname(filePath)
            
            if (!dirSet.has(dir)) {
              return yield* Effect.fail({
                _tag: 'WriteFileError' as const,
                path: filePath,
                cause: 'Directory does not exist'
              })
            }
            
            yield* Ref.update(files, map => new Map(map.set(filePath, content)))
          }),

        exists: (filePath: string) =>
          Effect.gen(function* () {
            const fileMap = yield* Ref.get(files)
            const dirSet = yield* Ref.get(directories)
            const symlinkMap = yield* Ref.get(symlinks)
            return fileMap.has(filePath) || dirSet.has(filePath) || symlinkMap.has(filePath)
          }),

        mkdir: (dirPath: string) =>
          Effect.gen(function* () {
            yield* Ref.update(directories, set => new Set(set.add(dirPath)))
            // Also add parent directories
            let current = path.dirname(dirPath)
            while (current !== '/' && current !== '.') {
              yield* Ref.update(directories, set => new Set(set.add(current)))
              current = path.dirname(current)
            }
          }),

        symlink: (target: string, linkPath: string) =>
          Effect.gen(function* () {
            const symlinkMap = yield* Ref.get(symlinks)
            if (symlinkMap.has(linkPath)) {
              return yield* Effect.fail({
                _tag: 'SymlinkError' as const,
                pointer: target,
                symlink: linkPath,
                cause: 'Symlink already exists'
              })
            }
            yield* Ref.update(symlinks, map => new Map(map.set(linkPath, target)))
          }),

        unlink: (linkPath: string) =>
          Effect.gen(function* () {
            const symlinkMap = yield* Ref.get(symlinks)
            const fileMap = yield* Ref.get(files)
            
            if (symlinkMap.has(linkPath)) {
              yield* Ref.update(symlinks, map => {
                const newMap = new Map(map)
                newMap.delete(linkPath)
                return newMap
              })
            } else if (fileMap.has(linkPath)) {
              yield* Ref.update(files, map => {
                const newMap = new Map(map)
                newMap.delete(linkPath)
                return newMap
              })
            } else {
              return yield* Effect.fail({
                _tag: 'UnlinkError' as const,
                symlink: linkPath,
                cause: 'File or symlink not found'
              })
            }
          }),

        readdir: (dirPath: string) =>
          Effect.gen(function* () {
            const dirSet = yield* Ref.get(directories)
            const fileMap = yield* Ref.get(files)
            const symlinkMap = yield* Ref.get(symlinks)
            
            if (!dirSet.has(dirPath)) {
              return yield* Effect.fail({
                _tag: 'ReadDirectoriesError' as const,
                path: dirPath,
                cause: 'Directory not found'
              })
            }
            
            const entries: string[] = []
            
            // Add files in this directory
            for (const filePath of fileMap.keys()) {
              if (path.dirname(filePath) === dirPath) {
                entries.push(path.basename(filePath))
              }
            }
            
            // Add symlinks in this directory
            for (const linkPath of symlinkMap.keys()) {
              if (path.dirname(linkPath) === dirPath) {
                entries.push(path.basename(linkPath))
              }
            }
            
            // Add subdirectories
            for (const dir of dirSet) {
              if (path.dirname(dir) === dirPath && dir !== dirPath) {
                entries.push(path.basename(dir))
              }
            }
            
            return entries
          }),

        rm: (filePath: string, options: { recursive?: boolean, force?: boolean } = {}) =>
          Effect.gen(function* () {
            const fileMap = yield* Ref.get(files)
            const dirSet = yield* Ref.get(directories)
            const symlinkMap = yield* Ref.get(symlinks)
            
            if (fileMap.has(filePath)) {
              yield* Ref.update(files, map => {
                const newMap = new Map(map)
                newMap.delete(filePath)
                return newMap
              })
            } else if (symlinkMap.has(filePath)) {
              yield* Ref.update(symlinks, map => {
                const newMap = new Map(map)
                newMap.delete(filePath)
                return newMap
              })
            } else if (dirSet.has(filePath)) {
              if (options.recursive) {
                // Remove directory and all contents
                yield* Ref.update(directories, set => {
                  const newSet = new Set(set)
                  newSet.delete(filePath)
                  // Remove subdirectories
                  for (const dir of set) {
                    if (dir.startsWith(filePath + '/')) {
                      newSet.delete(dir)
                    }
                  }
                  return newSet
                })
                
                // Remove files in directory
                yield* Ref.update(files, map => {
                  const newMap = new Map(map)
                  for (const file of map.keys()) {
                    if (file.startsWith(filePath + '/')) {
                      newMap.delete(file)
                    }
                  }
                  return newMap
                })
                
                // Remove symlinks in directory
                yield* Ref.update(symlinks, map => {
                  const newMap = new Map(map)
                  for (const link of map.keys()) {
                    if (link.startsWith(filePath + '/')) {
                      newMap.delete(link)
                    }
                  }
                  return newMap
                })
              } else {
                return yield* Effect.fail({
                  _tag: 'RemoveEntryError' as const,
                  path: filePath,
                  cause: 'Directory not empty'
                })
              }
            } else if (!options.force) {
              return yield* Effect.fail({
                _tag: 'RemoveEntryError' as const,
                path: filePath,
                cause: 'File not found'
              })
            }
          }),

        lstat: (filePath: string) =>
          Effect.gen(function* () {
            const symlinkMap = yield* Ref.get(symlinks)
            return {
              isSymbolicLink: () => symlinkMap.has(filePath)
            }
          }),

        rename: (oldPath: string, newPath: string) =>
          Effect.gen(function* () {
            const fileMap = yield* Ref.get(files)
            const content = fileMap.get(oldPath)
            
            if (content === undefined) {
              return yield* Effect.fail({
                _tag: 'MoveEntryError' as const,
                from: oldPath,
                to: newPath,
                cause: 'Source file not found'
              })
            }
            
            yield* Ref.update(files, map => {
              const newMap = new Map(map)
              newMap.delete(oldPath)
              newMap.set(newPath, content)
              return newMap
            })
          }),

        reset: () =>
          Effect.gen(function* () {
            yield* Ref.set(files, new Map())
            yield* Ref.set(directories, new Set(['/']))
            yield* Ref.set(symlinks, new Map())
          })
      }
    })
  )
}

// Mock Git Service
export interface MockGitService {
  readonly isAvailable: Effect.Effect<boolean>
  readonly clone: (url: string, target: string) => Effect.Effect<void, { _tag: 'ExecCommandError', command: string, cause: unknown }>
  readonly pull: (directory: string) => Effect.Effect<void, { _tag: 'ExecCommandError', command: string, cause: unknown }>
  readonly setAvailable: (available: boolean) => Effect.Effect<void>
  readonly setCloneResult: (result: 'success' | 'failure') => Effect.Effect<void>
}

export class MockGitService extends Context.Tag('MockGitService')<
  MockGitService,
  MockGitService
>() {
  static readonly Live = Layer.succeed(
    MockGitService,
    // @ts-expect-error - Complex nested Effect types cause inference issues but the implementation is correct
    Effect.gen(function* () {
      const available = yield* Ref.make(true)
      const cloneResult = yield* Ref.make<'success' | 'failure'>('success')

      return {
        isAvailable: Ref.get(available),

        clone: (url: string, target: string) =>
          Effect.gen(function* () {
            const result = yield* Ref.get(cloneResult)
            if (result === 'failure') {
              return yield* Effect.fail({
                _tag: 'ExecCommandError' as const,
                command: `git clone --depth 1 ${url} ${target}`,
                cause: 'Git clone failed'
              })
            }
            // Simulate successful clone by creating a directory
            const mockFs = yield* MockFileSystemService
            yield* mockFs.mkdir(target)
          }),

        pull: (directory: string) =>
          Effect.gen(function* () {
            const result = yield* Ref.get(cloneResult)
            if (result === 'failure') {
              return yield* Effect.fail({
                _tag: 'ExecCommandError' as const,
                command: `git pull`,
                cause: 'Git pull failed'
              })
            }
          }),

        setAvailable: (isAvailable: boolean) => Ref.set(available, isAvailable),
        setCloneResult: (result: 'success' | 'failure') => Ref.set(cloneResult, result)
      }
    })
  )
}

// Mock Prompt Service  
export interface MockPromptService {
  readonly select: <A>(options: { message: string, choices: Array<{ title: string, value: A }> }) => Effect.Effect<A>
  readonly setResponse: <A>(response: A) => Effect.Effect<void>
}

export class MockPromptService extends Context.Tag('MockPromptService')<
  MockPromptService,
  MockPromptService
>() {
  static readonly Live = Layer.succeed(
    MockPromptService,
    // @ts-expect-error - Complex nested Effect types cause inference issues but the implementation is correct
    Effect.gen(function* () {
      const response = yield* Ref.make<unknown>('override')

      return {
        select: <A>(_options: { message: string, choices: Array<{ title: string, value: A }> }) =>
          Effect.gen(function* () {
            const resp = yield* Ref.get(response)
            return resp as A
          }),

        setResponse: <A>(resp: A) => Ref.set(response, resp)
      }
    })
  )
}

// Test Layer that combines all mock services
export const TestServices = Layer.mergeAll(
  MockFileSystemService.Live,
  MockGitService.Live,
  MockPromptService.Live
)

// Test helpers
export const createTempTestDir = () =>
  Effect.gen(function* () {  
    const tempDir = yield* Effect.promise(() => fs.mkdtemp(path.join(os.tmpdir(), 'loom-test-')))
    return tempDir
  })

export const withTempDir = <A, E, R>(
  effect: (dir: string) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const tempDir = yield* createTempTestDir()
    
    try {
      return yield* effect(tempDir)
    } finally {
      yield* Effect.promise(() => fs.rm(tempDir, { recursive: true, force: true })).pipe(
        Effect.catchAll(() => Effect.void)
      )
    }
  })

// Constants for testing
export const TEST_HOME = '/test-home'
export const TEST_DOTFILES_ROOT = path.join(TEST_HOME, '.dotfiles')
export const TEST_CONFIG_PATH = path.join(TEST_DOTFILES_ROOT, 'loom.toml')

// Setup test environment
export const setupTestEnvironment = () =>
  Effect.gen(function* () {
    const mockFs = yield* MockFileSystemService
    yield* mockFs.reset()
    yield* mockFs.mkdir(TEST_HOME)
    yield* mockFs.mkdir(TEST_DOTFILES_ROOT)
  })