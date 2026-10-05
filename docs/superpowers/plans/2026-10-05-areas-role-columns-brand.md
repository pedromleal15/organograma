# Areas + Role Columns + Brandbook Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Expand Glyco areas, support workflow + role Kanban columns, RoleModal on org-card click with embedded role column, and Brandbook CSS tokens.

**Architecture:** Extend `BoardColumn` with `kind`/`roleId`; seed + migrate areas; domain rules keep role↔column titles synced; UI RoleModal reuses LaneModal patterns; CSS variables from Brandbook on light theme.

**Tech Stack:** React/Vite/TypeScript, Vitest, existing `store.apply` domain rules.

**Spec:** `docs/superpowers/specs/2026-10-05-areas-role-columns-brand-design.md`

## Global Constraints

- Areas never become Quadro columns.
- Workflow and role columns coexist.
- Light product UI; Brandbook tokens only (no full dark-first flip).
- Do not invent occupants for new areas.
- Preserve todo/doing/blocked/done column ids.

---

### Task 1: Domain types + board helpers

**Files:** `src/domain/types.ts`, `src/domain/board.ts`, `tests/domain.test.ts`

- [ ] Add `kind: 'workflow' | 'role'` and `roleId: string | null` to `BoardColumn`
- [ ] Tag starter columns as workflow; add `ensureColumnKinds`, `roleColumnId`, `ensureCeoRoleColumns`
- [ ] Tests for kind defaults and CEO column ensure

### Task 2: Seed areas + CEO columns + migration

**Files:** `src/domain/seed.ts`, `src/domain/rules.ts` (load/normalize), `tests/domain.test.ts`

- [ ] Seed 13 areas on atual + planejada
- [ ] Seed CEO role columns both scenarios
- [ ] Upsert missing areas on document normalize without wiping user data

### Task 3: Rules — create/sync role columns

**Files:** `src/domain/rules.ts`, `tests/domain.test.ts`

- [ ] `addRoleColumn` / create role auto-creates role column
- [ ] `updateRole` title syncs linked role column title
- [ ] `addColumn` sets `kind: 'workflow'`

### Task 4: RoleModal UI

**Files:** `src/ui/organograma.tsx`, `src/ui/canvas.tsx`, `src/styles.css`, `tests/ui.test.tsx`

- [ ] Click role node opens RoleModal (edit + embedded column tasks)
- [ ] Ensure role column exists when modal opens
- [ ] Keep drawer optional or replace with modal per spec

### Task 5: Brandbook tokens + column chrome

**Files:** `src/styles.css`

- [ ] Map CSS vars to Brandbook hexes
- [ ] Style `.column-role` vs `.column-workflow`

### Task 6: Verify

- [ ] `npx tsc --noEmit && npx vitest run && npm run build`
