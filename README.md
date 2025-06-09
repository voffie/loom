# 🧵 Loom

**Loom** is a modern, flexible dotfiles manager designed to make configuring and syncing your development environment effortless.

> _"Weave your dotfiles setup, your way."_

---

## 🚧 Status
This project is under active development

## ✨ Features (WIP)

- 🔧 Scaffold a clean dotfiles setup from scratch
- 🧩 Import existing configs (local or remote)
- 🔗 Symlink dotfiles to their intended locations
- 🔄 Swap configurations using simple TOML config
- ☁️ Pull in remote templates from GitHub or any repo
- ⏫ Check for upstream updates and apply them cleanly

---

## 💡 Vision

Loom aims to help developers:

- Start from **scratch**, **adopt templates**, or **import existing configs**
- Keep everything in **one directory** (`~/.dotfiles`)
- Use a **plugin-like model** to manage configs for tools like `nvim`, `zsh`, `tmux`, etc.
- Define everything in a single, clean `loom.toml` file
- Let the CLI do the heavy lifting — installation, updates, linking, and swapping setups

---

## 🗂 Example `loom.toml`

```toml
[settings]
dotfiles_dir = "~/.dotfiles"

[nvim]
source = "nvim-lua/kickstart.nvim"
target = "~/.config/nvim"

[zsh]
source = "~/dev/zsh-config"
target = "~/.zshrc"
```
