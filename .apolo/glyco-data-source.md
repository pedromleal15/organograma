# Fonte de dados da Glyco — validação e lacunas

> Registrado em 2026-10-04. Atualize este arquivo quando uma fonte confirmar ou corrigir um dado.

## Fontes consultadas nesta rodada

| Fonte | Status | O que rendeu |
|---|---|---|
| Brain MCP (Obsidian) | ❌ fora do ar (`MCP_BINARY_NOT_FOUND`) | nada — fallback ativado |
| Repo `pedromleal15/pedro-brain` via GitHub API | ✅ | `references/glyco.md` + notas de sessão |
| apolo-memory MCP | ✅ mas vazio | 0 páginas sobre organograma |
| Google Drive | ❌ erro de integração | — |

## Fatos confirmados no Brain (com fonte)

Extraídos de `references/glyco.md` e notas de journal do vault:

- **Tipo de empresa:** SaaS médico de controle glicêmico; app em `app.glyco.med.br`.
- **Áreas com trabalho ativo documentado:** Engenharia/Produto (PRs, sprints), Segurança & Compliance (RLS, PHI, hardening), Dados (roadmap Linear), Qualidade (roadmap Linear), Jurídico/Regulatório (LGPD/PHI, roadmap Linear), Comercial & Marketing (funil pré-lançamento), Clínico (speech→prontuário, endócrino).
- **Goal comercial ativo:** fechar **3 médicos** (endo/nutrólogo esportivo) via abordagem pessoal no WhatsApp; métricas de funil: 25 interação → 15 conversam → 12 demo → 10 ativam → 8 semana 1 → 6 voltam.
- **Goal técnico recente:** assinatura digital ICP-Brasil A1/A3 (web-pki PR #451, set/2026) — etapa de preparação, sem certificado real ainda.
- **Estratégia comercial:** pessoal primeiro (WhatsApp 1:1); ads/Instagram só depois de validar ângulo vencedor. Meta é conversão, não awareness.
- **Roadmap de áreas (Linear, 2026-07-29):** 50 livros criados nas áreas AI, Security, Data, Quality, Legal; 7 áreas falharam por limite de uso.

## Lacunas (NÃO preencher por suposição)

1. **Hierarquia de pessoas:** o Brain não documenta organograma, cargos de C-level além do fundador, ou quem lidera cada área. Desconhecido.
2. **Headcount por área:** desconhecido.
3. **Goals/OKRs por área:** só o comercial tem meta quantificada (3 médicos). Demais áreas: metas não documentadas.
4. **Vínculos (CLT/PJ/sócio):** desconhecido.
5. **Quem é o gestor de quem:** desconhecido além de "Pedro = fundador/CEO" (implícito em todas as notas).

## Política de dados do app

Definida pelo dono em 2026-10-04:
- **Sem dados pessoais:** o app modela **cargos e áreas**, não pessoas. Campos de nome, contato e localidade foram removidos.
- Dados novos só entram quando uma fonte confirmar; caso contrário ficam como lacuna aqui.
