import fg from "fast-glob";
import * as path from "path";
import * as vscode from "vscode";

const SUPPORTED_GLOBS = ["**/*.{ts,tsx,js,jsx}"];
const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/.next/**",
  "**/coverage/**",
  "**/out/**",
];

export async function scanWorkspaceFiles(): Promise<string[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return [];
  }

  const allEntries = await Promise.all(
    folders.map(async (folder) => {
      const cwd = folder.uri.fsPath;
      const entries = await fg(SUPPORTED_GLOBS, {
        cwd,
        absolute: true,
        onlyFiles: true,
        ignore: DEFAULT_IGNORES,
      });

      return entries.map((file) => path.normalize(file));
    })
  );

  return [...new Set(allEntries.flat())];
}
