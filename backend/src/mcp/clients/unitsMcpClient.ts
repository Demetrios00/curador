import path from "path";

import { AppError } from "../../middleware/errorHandler";
import { FIND_NEARBY_UNITS_TOOL_NAME } from "../tools/findNearbyUnits";
import { createMcpConnection } from "./mcpConnectionFactory";

/** Host + Client MCP do domínio de Unidades (Fase 6). */
const connection = createMcpConnection({
  serverEntrypoint: path.join(__dirname, "../servers/unitsMcpServer"),
  clientName: "curador-backend-units-mcp-client",
});

/** Fecha a conexão MCP de Unidades (e o subprocesso do servidor). Chamado no shutdown do backend. */
export async function closeUnitsMcpClient(): Promise<void> {
  await connection.close();
}

export interface NearbyUnit {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  services: string[];
  distanceKm: number;
}

export interface FindNearbyUnitsResult {
  units: NearbyUnit[];
  skippedWithoutCoordinates: number;
}

/** Chama a ferramenta MCP `find_nearby_units`. Usada pelo Agente de Unidades. */
export async function callFindNearbyUnits(
  latitude: number,
  longitude: number,
  limit?: number
): Promise<FindNearbyUnitsResult> {
  const client = await connection.getClient();

  const result = await client.callTool({
    name: FIND_NEARBY_UNITS_TOOL_NAME,
    arguments: { latitude, longitude, ...(limit !== undefined ? { limit } : {}) },
  });

  const content = result.content as Array<{ type: string; text?: string }> | undefined;
  const textBlock = content?.find((c) => c.type === "text");

  if (result.isError) {
    throw new AppError(
      textBlock?.text ?? "Falha ao executar a ferramenta MCP find_nearby_units.",
      502,
      "MCP_TOOL_ERROR"
    );
  }

  if (!textBlock?.text) {
    throw new AppError(
      "Resposta inesperada da ferramenta MCP find_nearby_units.",
      502,
      "MCP_INVALID_RESPONSE"
    );
  }

  return JSON.parse(textBlock.text) as FindNearbyUnitsResult;
}
