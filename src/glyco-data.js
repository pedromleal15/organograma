/**
 * Dados da Glyco alinhados ao organograma corporativo.
 * Hierarquia de cargos: validada via GitHub pedro-brain (glyco.md) + apolo-memory em 2026-10-04.
 * Áreas, metas, estratégias e lacunas: exemplos ilustrativos rotulados até fonte oficial confirmar.
 * Sem dados pessoais: apenas cargos e áreas, conforme diretriz do produto.
 */

export const GLYCO_DATA_SOURCE = {
  status: 'partial', // 'partial' = hierarquia validada, áreas/metas exemplos
  updatedAt: '2026-10-04',
  provenance: [
    'Hierarquia de cargos: GitHub pedro-brain (glyco.md) + apolo-memory — validado 2026-10-04',
    'Áreas, squads, metas, estratégias e lacunas: exemplos ilustrativos',
  ],
  note: 'Sem dados pessoais. Apenas cargos e áreas.',
};

// Estrutura consumida por main.js:
// - glycoAreas: [{ id, title, positions: [{ id, title, parentPositionId, confidence, source }], goals: [], strategy }]
// - glycoGaps: [{ id, title, description, area, parentPositionId, source }]
export const glycoAreas = [
  {
    id: 'diretoria',
    title: 'Diretoria',
    positions: [
      { id: 'ceo', title: 'CEO & Founder', parentPositionId: null, confidence: 'alta', source: 'pedro-brain' },
    ],
    goals: ['Growth definido e contratado', 'Governança e rituais executivos'],
    strategy: 'Definir direção, alocar capital e destravar contratações críticas.',
  },
  {
    id: 'clinica',
    title: 'Clínica',
    positions: [
      { id: 'medical-lead', title: 'Head Médico(a)', parentPositionId: 'ceo', confidence: 'alta', source: 'pedro-brain' },
    ],
    goals: ['Telemedicina com prescrição digital validada', 'Protocolos clínicos revisados'],
    strategy: 'Segurança do paciente (PHI) e conformidade LGPD/RLS como base de qualquer fluxo clínico.',
  },
  {
    id: 'produto',
    title: 'Produto',
    positions: [
      { id: 'eng-lead', title: 'Head de Engenharia', parentPositionId: 'ceo', confidence: 'alta', source: 'pedro-brain' },
      { id: 'cto-vago', title: 'CTO (vago)', parentPositionId: 'ceo', confidence: 'baixa', source: 'lacuna identificada' },
    ],
    goals: ['App glyco.med.br estável em produção', 'Dados & integrações (wearables, labs)'],
    strategy: 'Next.js 16 + Supabase + Vercel; squads Core App e Telemedicina como unidades de entrega.',
  },
  {
    id: 'operacoes',
    title: 'Operações',
    positions: [
      { id: 'ops-lead', title: 'Head de Operações', parentPositionId: 'ceo', confidence: 'alta', source: 'pedro-brain' },
    ],
    goals: ['Operações automatizadas (crons, WhatsApp)', 'Suporte e onboarding escaláveis'],
    strategy: 'Automação e disponibilidade como prioridade; reduzir trabalho manual recorrente.',
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    positions: [
      { id: 'fin-lead', title: 'Head Financeiro', parentPositionId: 'ceo', confidence: 'alta', source: 'pedro-brain' },
    ],
    goals: ['Receita recorrente com Stripe + métricas', 'Compliance e relatórios financeiros'],
    strategy: 'Assinaturas e métricas de receita recorrente como norte; compliance embutido.',
  },
];

// Squads/vínculos corporativos (exemplos ilustrativos, exibidos em versões futuras)
export const glycoSquads = [
  { id: 'squad-core', name: 'Core App', mission: 'App principal e dashboard do paciente', areaId: 'produto', lead: 'eng-lead', linkedGoals: ['goal-app'] },
  { id: 'squad-telemed', name: 'Telemedicina', mission: 'Fluxo de teleconsulta e prescrição digital', areaId: 'clinica', lead: 'medical-lead', linkedGoals: ['goal-telemed'] },
  { id: 'squad-data', name: 'Dados & Integrações', mission: 'Wearables, labs, prontuários', areaId: 'produto', lead: 'eng-lead', linkedGoals: ['goal-app'] },
  { id: 'squad-ops', name: 'Ops & Suporte', mission: 'Automação operacional e atendimento', areaId: 'operacoes', lead: 'ops-lead', linkedGoals: ['goal-ops'] },
];

export const glycoLinks = [
  { from: 'clinica', to: 'produto', label: 'Protocolos → App' },
  { from: 'produto', to: 'operacoes', label: 'Crons → Suporte' },
  { from: 'operacoes', to: 'financeiro', label: 'Ativação → Receita' },
];

// Lacunas de estrutura (nós explícitos no organograma)
export const glycoGaps = [
  { id: 'gap-1', title: 'CTO não contratado', area: 'Produto', impact: 'alto', description: 'Liderança técnica executiva em aberto; Head de Engenharia cobre parcialmente.', parentPositionId: 'ceo', source: 'exemplo ilustrativo' },
  { id: 'gap-2', title: 'Marketing/Growth sem dono', area: 'Diretoria', impact: 'médio', description: 'Aquisição e growth sem responsável definido.', parentPositionId: 'ceo', source: 'exemplo ilustrativo' },
  { id: 'gap-3', title: 'RH sem estrutura', area: 'Operações', impact: 'médio', description: 'Processos de gente (contratação, onboarding, desligamento) sem dono formal.', parentPositionId: 'ops-lead', source: 'exemplo ilustrativo' },
];

export const glycoGoals = [
  { id: 'goal-app', title: 'App glyco.med.br estável em produção', status: 'em-andamento', owner: 'eng-lead', area: 'produto' },
  { id: 'goal-telemed', title: 'Telemedicina com prescrição digital validada', status: 'planejado', owner: 'medical-lead', area: 'clinica' },
  { id: 'goal-ops', title: 'Operações automatizadas (crons, WhatsApp)', status: 'em-andamento', owner: 'ops-lead', area: 'operacoes' },
  { id: 'goal-rev', title: 'Receita recorrente com Stripe + métricas', status: 'planejado', owner: 'fin-lead', area: 'financeiro' },
  { id: 'goal-growth', title: 'Growth definido e contratado', status: 'planejado', owner: 'ceo', area: 'diretoria' },
];
