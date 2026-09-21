# Development Workflow & Tooling Rules

Rule: Adhere to proactive tool usage, the strict development pipeline, and verification principles.

## 1. Tooling Usage
- **Context7:** Always verify library/API docs before coding. Avoid outdated patterns. Fallback to web search if tool unavailable.
- **Supabase MCP:** Inspect existing schema first; use safe, reversible migrations; enforce RLS & atomic RPCs.
- **Playwright MCP:** Perform actual browser-based user journey verification, not just static code review.
- **Frontend Design Skill:** Craft modern, responsive, high-polish UI with complete states (loading, empty, error, active).
- **Figma MCP:** Inspect design specs, tokens, and components directly from Figma when designs are available.

## 2. Priority Pipeline
Context7 -> Figma/Frontend Design -> Code -> Supabase -> Playwright -> Fix & Verify.

## 3. Strict Rules
- Never hallucinate APIs, packages, DB fields, or functions.
- Avoid deprecated APIs.
- Never alter database without inspecting existing schema.
- Never declare a task complete solely because code builds without errors.
- Always verify actual end-to-end user journeys with tests/Playwright.
- Maintain project architectural integrity and account isolation.
