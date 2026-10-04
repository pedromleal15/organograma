// Organograma da Glyco — cargos e áreas, sem dados pessoais.
// Fatos confirmados no Brain (pedro-brain, references/glyco.md) em 2026-10-04.
// Lacunas documentadas em .apolo/glyco-data-source.md — NÃO preencher por suposição.

export const glycoAreas = [
  {
    id: 'glyco',
    title: 'Glyco',
    subtitle: 'SaaS médico · controle glicêmico',
    parentId: '',
    goals: ['Pré-lançamento comercial: fechar 3 médicos (endo/nutrólogo esportivo)'],
    strategy: 'Abordagem pessoal 1:1 no WhatsApp; canais públicos (IG/LinkedIn) só depois de validar o ângulo vencedor.',
    source: 'confirmado',
  },
  {
    id: 'engenharia-produto',
    title: 'Engenharia & Produto',
    subtitle: 'Next.js + Supabase · app.glyco.med.br',
    parentId: 'glyco',
    goals: ['Assinatura digital ICP-Brasil (web-pki) em preparação'],
    strategy: 'Sprints curtos com PR verificado em produção antes do próximo.',
    source: 'confirmado',
  },
  {
    id: 'seguranca-compliance',
    title: 'Segurança & Compliance',
    subtitle: 'RLS + double-lock em tabelas PHI',
    parentId: 'glyco',
    goals: [],
    strategy: 'Toda tabela sensível: RLS ON + REVOKE ALL FROM anon (decisão D-018).',
    source: 'confirmado',
  },
  {
    id: 'dados',
    title: 'Dados',
    subtitle: 'Roadmap no Linear',
    parentId: 'glyco',
    goals: [],
    strategy: '',
    source: 'confirmado',
  },
  {
    id: 'qualidade',
    title: 'Qualidade',
    subtitle: 'Roadmap no Linear · CI com vitest',
    parentId: 'glyco',
    goals: [],
    strategy: '',
    source: 'confirmado',
  },
  {
    id: 'juridico-regulatorio',
    title: 'Jurídico & Regulatório',
    subtitle: 'LGPD / dados de saúde (PHI)',
    parentId: 'glyco',
    goals: [],
    strategy: '',
    source: 'confirmado',
  },
  {
    id: 'comercial-marketing',
    title: 'Comercial & Marketing',
    subtitle: 'Funil pré-lançamento',
    parentId: 'glyco',
    goals: ['3 médicos clientes', 'Funil: 25 interações → 15 conversam → 12 demos → 10 ativam'],
    strategy: 'WhatsApp (Status + 1:1) como eixo; CTA único wa.me. Fora: ads, TikTok, YouTube.',
    source: 'confirmado',
  },
  {
    id: 'clinico',
    title: 'Clínico',
    subtitle: 'Speech→prontuário (SOAP-PT) · conteúdo endócrino',
    parentId: 'glyco',
    goals: [],
    strategy: '',
    source: 'confirmado',
  },
].map((area) => ({
  ...area,
  positions: [
    {
      id: area.id,
      title: area.title,
      parentPositionId: area.parentId,
      confidence: area.source === 'confirmado' ? 'high' : 'medium',
      source: area.source,
    },
  ],
}));

export const glycoGaps = [
  {
    id: 'gap-hierarquia',
    title: 'Hierarquia de cargos',
    area: 'Geral',
    description: 'Cargos e gestores não documentados no Brain',
    parentPositionId: '',
    source: 'lacuna',
  },
  {
    id: 'gap-headcount',
    title: 'Headcount por área',
    area: 'Geral',
    description: 'Headcount desconhecido',
    parentPositionId: 'glyco',
    source: 'lacuna',
  },
  {
    id: 'gap-goals',
    title: 'Goals por área',
    area: 'Geral',
    description: 'Só Comercial tem meta quantificada',
    parentPositionId: 'glyco',
    source: 'lacuna',
  },
];
