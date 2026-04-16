---
name: Windows Environment Guard
description: "Before running commands, verify the current terminal session is Windows and not WSL, Ubuntu, or Linux."
argument-hint: "Check the shell environment before executing commands"
agent: agent
---
Before executing any command in this workspace:
- Verify the active environment is Windows.
- If the session is WSL, Ubuntu, or any Linux shell, do not run commands.
- Stop and tell the user to switch to a Windows terminal such as PowerShell or Command Prompt.
- Use Windows paths and Windows-native tooling only.
- If environment detection is needed, perform a non-destructive check first.
