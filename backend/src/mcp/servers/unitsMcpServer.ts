import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  FIND_NEARBY_UNITS_TOOL_NAME,
  findNearbyUnitsHandler,
  findNearbyUnitsInputSchema,
} from "../tools/findNearbyUnits";

/**
 * Servidor MCP de Unidades — processo Node independente, iniciado pelo
 * backend (via `mcp/clients/unitsMcpClient.ts`) como subprocesso,
 * comunicando-se por stdio.
 *
 * Único lugar que conhece a coleção `hospitals` para fins de busca por
 * proximidade — o Agente de Unidades (`agents/units/`) não acessa o
 * Firestore diretamente.
 */
import "dotenv/config";

const server = new McpServer({
  name: "curador-units-mcp-server",
  version: "0.1.0",
});

/**
 * `registerTool` é chamado via cast de tipo estreito — mesmo motivo
 * documentado em `appointmentsMcpServer.ts` (limitação de profundidade de
 * instanciação de tipos do TypeScript ao combinar o "raw shape" do Zod com
 * os tipos internos recursivos do próprio Zod nas assinaturas do SDK).
 */
(server.registerTool as (...args: unknown[]) => unknown)(
  FIND_NEARBY_UNITS_TOOL_NAME,
  {
    title: "Encontrar unidades de saúde próximas",
    description:
      "Retorna as unidades de saúde (hospitais) mais próximas de uma coordenada geográfica, ordenadas por distância.",
    inputSchema: findNearbyUnitsInputSchema,
  },
  findNearbyUnitsHandler
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[units-mcp-server] falha ao iniciar:", err);
  process.exit(1);
});
