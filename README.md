# CuraDor — TCC: Arquitetura Multiagente baseada em MCP

Protótipo do Trabalho de Conclusão de Curso **"Proposta de uma Arquitetura
Multiagente baseada em Model Context Protocol Aplicada a um Aplicativo
Mobile de Saúde"** — Estevão Demétrio Ibrahim, Engenharia de Software,
UTFPR (Câmpus Dois Vizinhos).

## Estrutura do repositório

```text
curador/
├── backend/   Node.js + TypeScript — Agente Orquestrador, agentes
│              especializados (Agendamentos, Instruções, Resultados,
│              Unidades), camada Model Context Protocol (MCP), integração
│              Firebase Admin e LLM. Ver backend/README.md.
└── mobile/    React Native + Expo + TypeScript — aplicativo do paciente.
```

## Arquitetura

```text
App CuraDor (React Native + Expo)
   ↓  POST /api/orchestrator/route (autenticado — ID token Firebase)
Backend (Node.js + TypeScript)
   ↓
Agente Orquestrador → classifica a intenção da mensagem
   ↓
Agentes Especializados (Agendamentos | Instruções | Resultados | Unidades)
   ↓
Model Context Protocol → Firebase Firestore / Auth · Geolocalização
```

Documentação técnica completa da implementação do backend (decisões de
arquitetura, MCP, rastreabilidade, etc.): ver `backend/README.md`.

## Como rodar localmente

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # preencha com suas credenciais reais (nunca commitadas)
npm run dev
```

Health check: `http://localhost:3333/health`

### 2. Mobile

```bash
cd mobile
npm install
cp .env.example .env   # aponte para o endereço do backend (ver comentários no arquivo)
npx expo start
```

- **Android Emulator (Android Studio):** `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3333`
- **iOS Simulator:** `EXPO_PUBLIC_API_BASE_URL=http://localhost:3333`
- **Dispositivo físico:** `EXPO_PUBLIC_API_BASE_URL=http://SEU_IP_LOCAL:3333` (mesma rede Wi-Fi do backend)

## Segurança

Nenhuma credencial (chave de LLM, credenciais do Firebase Admin, etc.) é
armazenada no código do app mobile — toda chamada à IA e ao Firestore
passa pelo backend, autenticada por ID token do Firebase. Ver
`backend/README.md`, seção de segurança, para detalhes.
