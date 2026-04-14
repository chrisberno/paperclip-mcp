# paperclip-mcp

MCP server for Paperclip COP. Exposes tools for listing/reading/creating/updating agents and issues across companies.

## Usage

```bash
npx paperclip-mcp
```

## Environment

| Var | Required | Default | Notes |
|---|---|---|---|
| `PAPERCLIP_URL` | no | `http://100.66.243.41:3100` | Paperclip COP base URL |
| `PAPERCLIP_EMAIL` | no | `chris@chrisberno.dev` | Auth email |
| `PAPERCLIP_PASSWORD` | yes | — | Auth password |
| `PAPERCLIP_COMPANY_ID` | no | Onreb UUID | Default company when tool `company_id` omitted |

## Tools (v0.1.0)

- `list_companies`
- `get_company`
- `list_agents`
- `get_agent`
- `create_agent`
- **`update_agent`** — `title`, `reports_to`, `capabilities`, `icon`, `budget_monthly_cents` (new in 0.1.0)
- `list_issues`
- `get_issue`
- `create_issue`
- `get_activity`

## License

MIT
