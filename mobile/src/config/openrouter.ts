/**
 * DEPRECATED — este arquivo não deve mais ser importado por nenhuma tela.
 *
 * A chave da OpenRouter que estava aqui hardcoded (achado crítico da
 * auditoria Fase 0) foi removida deste arquivo e a integração com a LLM
 * foi migrada para o backend (Fase 2 do roadmap). A chamada à IA agora é
 * feita via `src/services/orchestratorApi.ts` (`POST /api/orchestrator/route`),
 * sem nenhuma credencial no app mobile.
 *
 * AÇÃO OBRIGATÓRIA (se ainda não foi feita): a chave antiga deve ser
 * tratada como comprometida — revogue-a em https://openrouter.ai/keys.
 * O bundle já compilado do app (se publicado anteriormente) pode conter
 * a chave em texto plano.
 *
 * RECOMENDAÇÃO: exclua este arquivo (`src/config/openrouter.ts`) do
 * projeto — ele é mantido aqui apenas como registro da migração.
 */
export {};
