# FinanceAI — Contexto

> Arquivo de memória do projeto. Qualquer IA (Kiro, Claude, outra) deve ler isto antes de trabalhar aqui e **atualizar ao fim de uma sessão que gerou informação nova relevante**.

## Visão geral
Plataforma web de finanças pessoais com foco em **Open Finance Brasil**. O usuário conecta bancos reais via Open Finance (agregador Pluggy) e uma IA consolida, analisa e conversa sobre a situação financeira em linguagem natural. Uso pessoal primeiro, com arquitetura que permite escalar para SaaS multi-tenant sem reescrita.

## Regras absolutas
- Nunca commitar credenciais. Segredos em `.env` / `apps/*/.env` (no `.gitignore`). `apps/web/.env.development` é commitável (sem segredos, só flags de sandbox).
- Reconciliação automática obrigatória: evitar duplicidade entre Open Finance + lançamento manual + import CSV.

## Stack e arquitetura
- Backend: Python 3.12 (FastAPI). Frontend: Vite. PostgreSQL. Orquestração via Docker Compose.
- Entrada única no browser: **http://localhost** (nginx). Porta 3000 = Vite dev sem proxy `/api` (não usar direto). API direta/debug: http://localhost:8001, Swagger em `/docs`.
- Dev (WSL): `docker-compose up -d --build`.
- Testes: `docker exec financeai-api python -m pytest tests -v`. Lint/build web: `docker exec financeai-web npm run lint` / `npm run build`.
- Diferenciais: conexão bancária via Pluggy, chat de IA, parsing de lançamento por linguagem natural, modo privacidade (ocultar valores), dashboard consolidado.

## Decisões e histórico
- Gotcha operacional: ao recriar o container da API, **reiniciar o nginx** (`docker restart financeai-nginx`) — ele cacheia o IP antigo e responde 502.
- Níveis de acesso Usuário/Administrador + limpeza de dados + correção de duplicidade na importação (commit 6779c1f).

## Credenciais (por referência — NUNCA o valor)
- Arquivo de segredos: `.env` (raiz) e por app em `apps/`. Template: `.env.example`.
- Envolve chaves da API Pluggy (Open Finance) e do banco/IA.

## Estado atual / próximos passos
- Repo no GitHub: github.com/leonunesm33/finance-ai (público). Branch `main`. Também há remote `backup` local em `/mnt/d/Projetos/finance-ai.git`.
- Ver `DEPLOY.md` e `prompt-financeai-openfinance.md` (prompt-mestre de construção por módulos).
