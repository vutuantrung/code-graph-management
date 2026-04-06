# Code Graph Management

A VS Code extension for exploring file dependencies and symbol relationships inside a workspace.

## Current capabilities

- Scan workspace source files (`.ts`, `.tsx`, `.js`, `.jsx`)
- Build a file dependency graph from relative imports
- Search files and inspect dependencies / dependents
- Find references for the symbol under the active cursor
- Open files and reference locations directly from the webview
- List document symbols for a file and inspect symbol details

## Architecture

- `GraphService`: builds and serves the file graph
- `GraphIndex`: fast lookup for incoming / outgoing edges and top-connected files
- `SymbolService`: active-cursor reference lookup
- `SymbolExplorerService`: document symbol listing and symbol inspection
- `GraphPanel`: webview lifecycle and message routing

## Commands

- `my-codegraph.openGraph`
- `my-codegraph.showSymbolReferences`

## Development

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the extension development host.

## Notes

This version keeps the UI intentionally simple and focuses on correctness, navigation, and service boundaries.
