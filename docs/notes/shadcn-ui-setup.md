# shadcn/ui Setup Notes

This repository uses the shadcn UI registry with the `base-nova` style and `base` component base.

## Current Setup

- `components.json` points `ui` to `@/components/ui`
- Tailwind CSS is configured through `app/globals.css`
- `components/ui` contains the shared UI primitives used across the app
- `TooltipProvider` is wrapped in `app/layout.tsx` for tooltip support

## Install or Re-sync

For an existing Next.js app, shadcn recommends initializing the project and then adding components from the CLI.

```bash
npx shadcn@latest init -t next
npx shadcn@latest add button dialog card
```

If you need to overwrite the current component files from the registry, use:

```bash
npx shadcn@latest add button dialog card -y -o -c .
```

## Useful CLI Commands

- `npx shadcn@latest info -c . --json` to inspect the current project setup
- `npx shadcn@latest view button dialog card` to inspect registry output
- `npx shadcn@latest add <component>` to install one or more components
- `npx shadcn@latest migrate radix` if you need to move component imports to `radix-ui`

## MCP Configuration

For VS Code with Copilot, configure the shadcn MCP server in `.vscode/mcp.json`:

```json
{
  "servers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

After adding the config, restart VS Code and start the server from the MCP view.

## Practical Notes

- Keep `components/ui` as the source of truth for shared primitives
- Prefer shadcn CLI updates over hand-editing registry components when possible
- When adding tooltip usage, ensure the app is wrapped with `TooltipProvider`