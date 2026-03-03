# Tauri 设置说明

## Rust 版本要求

Tauri 2.x 需要较新的 Rust 版本。如果遇到 `edition2024` 错误，请更新 Rust：

```bash
# 更新 Rust 到最新稳定版
rustup update stable

# 或者安装最新的 nightly 版本（如果需要）
rustup install nightly
rustup default nightly
```

## 验证 Rust 版本

```bash
rustc --version
cargo --version
```

推荐版本：
- Rust: 1.77.0 或更高
- Cargo: 1.77.0 或更高

## 如果无法更新 Rust

如果无法更新 Rust，可以在 `Cargo.toml` 中添加依赖版本锁定：

```toml
[patch.crates-io]
time-core = "0.1.2"
```

但这可能会导致其他依赖问题，建议优先更新 Rust。

## 安装 Tauri CLI

```bash
npm install -D @tauri-apps/cli
```

## 运行开发服务器

```bash
npx tauri dev
```

## 构建应用

```bash
npx tauri build
```
