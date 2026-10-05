# Glyco Organograma — Áreas, colunas por cargo e Brandbook

**Date:** 2026-10-05  
**Status:** Approved for implementation  
**Repo:** `pedromleal15/organograma`  
**Brand source:** `/Users/pedromleal/Downloads/Glyco.co/Brandbook`

## Summary

Expand Glyco areas in seed, keep areas for org/`@mentions` (not Kanban columns), allow **both** workflow task columns and **role-linked** columns on the Quadro, open a glass **RoleModal** on org-card click (edit role + embedded role column), and align CSS tokens with the Glyco Brandbook palette while keeping the product light (not full dark-first).

## §1 Areas (seed)

Flat areas on **Atual** and **Planejada** (PT titles):

1. Diretoria  
2. Clínica  
3. Produto  
4. Operações  
5. Financeiro  
6. Comercial  
7. Estratégia de Conteúdo  
8. Tráfego e Geração de Leads  
9. Vendas e Conversão  
10. Segurança e Compliance  
11. Jurídico e Regulatório  
12. People  
13. Customer Success  

Areas power: Novo cargo `areaId` select, `@Área` mentions, `AreaModal`.  
Areas do **not** create Quadro columns.

**Persistence note:** Documents already in localStorage/API keep prior areas until migrated or reset; seed applies to fresh documents. Prefer a one-shot migration that upserts missing area ids by title+scenario without wiping user data.

## §2 Columns = Tasks + Organograma roles

### Column kinds

| Kind | Meaning | Link | Visual |
|------|---------|------|--------|
| `workflow` (task) | Status/process columns (A fazer, Em andamento, …) | none / optional status key | Primary Blue accent |
| `role` | Column owned by a cargo | `roleId` | Ink + Primary filet |

Both kinds coexist on the same Quadro, same scroll/resize/rename/drag-task behavior, and both appear as Canvas lanes → existing `LaneModal`.

### Seed

- Keep current workflow starter columns per scenario.  
- Add at least one **role** column for **CEO & Founder** in each scenario that has that role.  
- Creating or “promoting” a role may create its role column (default: create role column when role is created, if none exists for that `roleId`).

### Role card click → RoleModal

Today: Canvas/matrix select opens side **drawer**.  
Target: glass **modal** (same a11y pattern as `LaneModal` / `AreaModal`):

1. Role edit fields (title, area, status, responsibilities — parity with current drawer).  
2. Embedded Quadro slice for that role’s column (tasks in the CEO column, etc.). If no role column exists yet, create it on open or show empty state + CTA to create.

Rename role → rename linked role column title (keep in sync via `store.apply`).

### Areas vs columns (decision)

User choice **2** then revised: board is **not** area-only.  
Final: **workflow + role columns**; areas never become columns.

## §3 Brandbook colors

Authoritative tokens from Brandbook “Paleta de Cores”:

| Token | Hex | CSS variable (proposed) |
|-------|-----|-------------------------|
| Primary Blue | `#0065D8` | `--blue` |
| System Blue | `#007AFF` | `--blue-2` / `--blue-system` |
| Ink | `#0A0A0A` | `--ink` |
| Paper white | `#FFFFFF` | `--card` |
| Paper secondary | `#F7F8FA` | `--bg` (replace `#EEF0F2`) |
| Muted | `#6B7280` | `--muted` |
| Clinical OK | `#10B981` | `--green` |
| Attention | `#F5A622` | `--amber` / `--attention` (legacy focus) |
| Risk | `#E5484D` | `--danger` |

Product stays **light**. Dark-first brand surfaces are out of scope except Ink for logo/typography accents and role-column chrome.  
Glass modals: Paper translucent + blur; Primary on focus.

## Architecture

- Single source: `AppDocument` via `store.apply(domain rules)`.  
- Extend `Column` type with `kind: 'workflow' | 'role'` and optional `roleId`.  
- Rules: `addColumn`, `addRoleColumn(roleId)`, sync title on `updateRole`, guards on delete role/column.  
- UI: `RoleModal` in organograma; Quadro styles distinguish column kinds; CSS variables from Brandbook.  
- Mentions/API areas unchanged except richer seed list.

## Testing

- Domain: area seed count; role column create/link; rename role renames column; cannot orphan invalid `roleId`.  
- UI: RoleModal opens from Canvas role click; embeds column tasks; workflow + role columns both render; brand tokens present in computed styles or snapshot of CSS vars.  
- Regression: LaneModal, AreaModal, `@` mentions, Nova tarefa close controls.

## Out of scope

- Full dark-first theme flip.  
- Nested areas under Comercial.  
- Auto-indexing `area_mentions` D1 on every save (already deferred).  
- Inventing people/occupants for new areas.

## Success criteria

1. All 13 areas available in Novo cargo (Atual + Planejada) after seed/migration.  
2. Quadro shows workflow columns and CEO role column; both work as lanes on Canvas.  
3. Clicking CEO (or any role) opens RoleModal with edit + embedded column.  
4. UI colors match Brandbook primary/paper/semantic tokens above.
