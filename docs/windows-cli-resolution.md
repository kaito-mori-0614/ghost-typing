# Windows VS Code CLI resolution

Ghost Typing must not execute a bare `code` command from `npm run` on Windows. npm prepends `node_modules/.bin` to PATH, so a different `code.cmd` can shadow the VS Code launcher.

The installer therefore:

1. Builds candidate absolute paths for `code.cmd` / `code-insiders.cmd`.
2. Prefers `GHOST_TYPING_CODE_CMD` and standard VS Code install locations before PATH.
3. Probes each existing candidate by executing the absolute `.cmd` through `cmd.exe /d /c <absolute-code.cmd> --version`.
4. Accepts a candidate only when the command succeeds and returns a VS Code-style semantic version.
5. Uses that same absolute `.cmd` through `cmd.exe` for extension installation and version verification.

It deliberately does not parse the contents of `code.cmd` and does not assume the internal location of `Code.exe` or `resources/app/out/cli.js`.

This matches the Windows execution pattern used by VS Code itself for `.cmd` launchers and keeps npm PATH shadowing out of the install path.
