# Contributing

Use Node 26.13.1 and npm from that toolchain. Run `npm ci`, `npm run format`, `npm run check`, `npm test`, and `npm run build`. Run extension-host and browser tests for behavior changes. The README lists platform-specific test commands.

Keep the runtime local and offline. Do not add telemetry, remote fonts, remote syntax resources, or source uploads. Treat captured source and webview messages as untrusted input. Render source with text nodes; validate message payloads and export limits before writing files.

Public issues and pull requests belong at https://github.com/kirasync2748/snapglow-studio. Keep dependencies locked and preserve license notices. Changes to publishing workflows require careful review of job permissions and artifact provenance.
