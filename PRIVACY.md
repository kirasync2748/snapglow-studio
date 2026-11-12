# Privacy

Snapglow does not collect telemetry, run analytics, make network requests, or upload source code. All syntax highlighting and rendering occur in the local VS Code webview using bundled resources.

Source snippets remain in the open studio panel. Closing the panel discards the snippet. Appearance settings and up to 12 presets are stored in VS Code global extension storage, including their window titles. They are not registered for Settings Sync. Uninstalling an extension may leave VS Code extension storage behind.

PNG and SVG exports are written only after you choose a destination in VS Code's save dialog. Clipboard copying writes an image only when requested. Images may contain sensitive code, titles, or comments that you choose to include.

The extension uses no external API keys, accounts, or authentication. GitHub Actions OIDC is used only by the maintainer's publishing workflow.
