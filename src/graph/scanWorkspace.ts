import fg from 'fast-glob';
import * as vscode from 'vscode';
import * as path from 'path';

export async function scanWorkspaceFiles() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return [];
    }

    const root = folders[0].uri.fsPath;

    const entries = await fg(
        ["**/*.{ts,tsx,js,jsx}"],
        {
            cwd: root,
            absolute: true,
            onlyFiles: true,
            ignore: [
                "**/node_modules/**",
                "**/dist/**",
                "**/build/**",
                "**/.git/**",
                "**/.next/**",
                "**/coverage/**"
            ]
        }
    );

    return entries.map(file => path.normalize(file));
}