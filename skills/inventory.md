# Skills Inventory

Registry of available, selected, and rejected skills.

| Skill | Scope | Status | Notes |
|-------|-------|--------|-------|
| `run` | base | selected | Launch/drive the app in-browser to verify each User Journey end-to-end during `/start-execution`. |
| `security-review` | base | selected | Run before delivery for the mandatory final holistic security audit (CLAUDE.md requirement). |
| `docx` | base | selected (one-time, already used) | Used during planning to extract `System_Prompt_Asistente_OopssNails.docx`. Not needed again unless the source doc changes. |
| `pdf` | base | selected (one-time, already used) | Used during planning to extract `Nuestros servicios Oopss Nails.pdf` (full price catalog). Not needed again unless the source doc changes. |
| `dataviz` | base | rejected | Considered for the admin health dashboard, but the dashboard's needs (a few status widgets, a today's-appointments list, an escalation counter) don't rise to the level of a chart/data-viz surface — plain components are simpler and sufficient. |
| `claude-api` | base | rejected | This project uses the OpenAI SDK, not the Anthropic/Claude API — not applicable to the chosen AI provider. |

## Evaluation Criteria

- Does an existing skill cover this need?
- Is the skill maintained and reliable?
- Does it integrate with the project stack?

(Populated during planning with /init-project)
