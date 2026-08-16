/**
 * DEPRECATED — este arquivo não deve mais existir no app mobile.
 *
 * A chave da OpenRouter que estava aqui foi migrada para o backend
 * (variável de ambiente LLM_API_KEY, ver backend/.env.example) e deve ser
 * tratada como comprometida: revogue a chave antiga em
 * https://openrouter.ai/keys assim que possível.
 *
 * O prompt de sistema (SYSTEM_PROMPT) também foi movido para o backend
 * (src/llm/systemPrompt.ts), pois a definição de comportamento do agente é
 * responsabilidade do servidor, não do app mobile.
 *
 * AÇÃO RECOMENDADA: exclua este arquivo do projeto (`src/config/openrouter.ts`).
 * Ele é mantido aqui apenas como registro da migração (Fase 2 do roadmap do TCC).
 * Nenhum outro arquivo do app deve importar `@/config/openrouter` — o único
 * ponto de acesso à IA agora é `src/services/api.ts` (`sendChatMessage`).
 */
export {};
