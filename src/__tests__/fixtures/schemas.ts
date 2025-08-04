import { Schema, FastCheck } from 'effect'
import * as path from 'node:path'

// Simple arbitraries without complex schema chaining

// Generate config file names (common dotfile names)
export const configNames = ['nvim', 'vim', 'tmux', 'zsh', 'bash', 'git', 'alacritty', 'kitty', 'i3']

// Generate GitHub repository identifiers (username/repo format)
export const gitHubRepos = [
  'craftzdog/dotfiles-public',
  'ohmyzsh/ohmyzsh', 
  'alacritty/alacritty',
  'tmux-plugins/tpm',
  'neovim/neovim'
]

// Generate target paths (where configs would be installed)
export const targetPaths = [
  '/test-home/.bashrc',
  '/test-home/.zshrc',
  '/test-home/.vimrc', 
  '/test-home/.tmux.conf',
  '/test-home/.gitconfig',
  '/test-home/.config/nvim',
  '/test-home/.config/alacritty',
  '/test-home/.config/tmux'
]

// Schema arbitraries using FastCheck directly
export const ConfigNameArbitrary = Schema.String.annotations({
  arbitrary: () => (fc) => fc.constantFrom(...configNames)
})

export const GitHubRepoArbitrary = Schema.String.annotations({
  arbitrary: () => (fc) => 
    fc.tuple(
      fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/),
      fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/)
    ).map(([user, repo]) => `${user}/${repo}`)
})

export const TargetPathArbitrary = Schema.String.annotations({
  arbitrary: () => (fc) => fc.constantFrom(...targetPaths)
})

export const LoomConfigEntryArbitrary = Schema.Struct({
  source: Schema.optional(GitHubRepoArbitrary),
  target: TargetPathArbitrary
})

export const LoomConfigArbitrary = Schema.Record({
  key: ConfigNameArbitrary,
  value: LoomConfigEntryArbitrary
}).annotations({
  arbitrary: () => (fc) =>
    fc.dictionary(
      fc.constantFrom(...configNames),
      fc.record({
        source: fc.option(fc.constantFrom(...gitHubRepos)),
        target: fc.constantFrom(...targetPaths)
      }),
      { minKeys: 1, maxKeys: 5 }
    )
})

// Invalid GitHub repo formats for negative testing
export const InvalidGitHubRepoArbitrary = Schema.String.annotations({
  arbitrary: () => (fc) =>
    fc.constantFrom(
      'no-slash',
      'too/many/slashes', 
      '/starts-with-slash',
      'ends-with-slash/',
      'has//double-slash',
      '',
      ' ',
      '/',
      '//',
      'user/',
      '/repo'
    )
})

// Safe paths (no path traversal)
export const SafePathArbitrary = Schema.String.annotations({
  arbitrary: () => (fc) =>
    fc.constantFrom(
      'nvim',
      'tmux', 
      'zsh',
      'config/nvim',
      'local/bin',
      'usr/share'
    )
})

// Malicious paths (for security testing)
export const MaliciousPathArbitrary = Schema.String.annotations({
  arbitrary: () => (fc) =>
    fc.constantFrom(
      '../../../etc/passwd',
      '../../..',
      '../..',
      '..',
      '/../root',
      '/etc/shadow',
      '../../../usr/bin/sudo',
      'test/../../sensitive',
      'normal/../../../etc/hosts'
    )
})

// User choice simulation
export const UserChoiceArbitrary = Schema.Literal('override', 'cancel').annotations({
  arbitrary: () => (fc) => fc.constantFrom('override', 'cancel')
})

// Test fixtures mapping (using relative paths)
export const TestFixtures = {
  validBasic: './src/__tests__/fixtures/configs/valid-basic.toml',
  validComplex: './src/__tests__/fixtures/configs/valid-complex.toml', 
  invalidMalformed: './src/__tests__/fixtures/configs/invalid-malformed.toml',
  empty: './src/__tests__/fixtures/configs/empty.toml'
}

// Helper function to create realistic test data
export const createRealisticConfig = (numEntries: number = 3) => {
  const entries: Record<string, { source?: string, target: string }> = {}
  const names = configNames.slice(0, numEntries)
  
  names.forEach((name, i) => {
    const hasSource = i % 2 === 0 // Alternate between having source and not
    entries[name] = {
      target: `/test-home/.config/${name}`,
      ...(hasSource && { source: gitHubRepos[i % gitHubRepos.length] })
    }
  })
  
  return entries
}

// Helper function to generate TOML from config object
export const configToTOML = (config: Record<string, { source?: string, target: string }>) => {
  let toml = ''
  for (const [name, entry] of Object.entries(config)) {
    toml += `[${name}]\n`
    if (entry.source) {
      toml += `source = "${entry.source}"\n`
    }
    toml += `target = "${entry.target}"\n\n`
  }
  return toml
}