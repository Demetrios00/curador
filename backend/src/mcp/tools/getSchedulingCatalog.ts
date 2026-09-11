import { listSchedulingCatalog } from "../../repositories/schedulingCatalog.repository";

/**
 * Ferramenta MCP `get_scheduling_catalog` (Ideia 5b — criação de
 * agendamento via linguagem natural).
 *
 * Leitura, igual às 4 ferramentas já existentes (Fases 5/6) — só passa a
 * existir para que o Agente de Agendamentos consiga resolver nomes ditos
 * em linguagem natural (unidade, especialidade, exame, cirurgia) contra o
 * cadastro real, sem o agente falar com o Firestore diretamente (mesmo
 * princípio das demais ferramentas: só o servidor MCP do domínio conhece o
 * Firestore).
 *
 * Sem parâmetros de entrada — o catálogo não depende do paciente.
 */
export const GET_SCHEDULING_CATALOG_TOOL_NAME = "get_scheduling_catalog";

export const getSchedulingCatalogInputSchema = {};

export async function getSchedulingCatalogHandler(_args: Record<string, never>) {
  const catalog = await listSchedulingCatalog();
  return {
    content: [{ type: "text" as const, text: JSON.stringify(catalog) }],
  };
}
