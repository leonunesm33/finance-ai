# Prompt: FinanceAI — Assistente Financeiro Pessoal com Open Finance Brasil

## Como usar este prompt

Cole este documento como primeira mensagem em uma sessão nova do Claude Code (VSCode).
Trabalharemos um módulo por vez — aguarde a instrução **"Implemente o Módulo X"** para iniciar cada etapa.
Ao concluir cada módulo, rode os health checks indicados e confirme antes de avançar.

---

## CONTEXTO DO PRODUTO

Você vai construir uma plataforma web de finanças pessoais com foco em **Open Finance Brasil** como diferencial central. O usuário conecta seus bancos reais via Open Finance (usando a API Pluggy como agregador), e a IA consolida, analisa e conversa sobre a situação financeira em linguagem natural. Lançamentos manuais convivem com dados bancários reais, com reconciliação automática para evitar duplicidades.

O produto é desenvolvido para **uso pessoal primeiro**, com arquitetura que permita escala posterior (multi-tenant, SaaS) sem reescrita.

**Diferenciais obrigatórios:**
- Conexão real com bancos brasileiros via Open Finance (Pluggy como agregador)
- Chat de IA para perguntas em linguagem natural sobre finanças
- Parsing de lançamentos manuais por IA ("gastei 150 no almoço")
- Reconciliação automática: evitar duplicidade entre Open Finance + lançamento manual + importação CSV
- Modo privacidade: ocultar todos os valores com um clique
- Dashboard com dados consolidados de múltiplas instituições

---

## STACK TÉCNICA — DECISÕES FIXAS

### Backend
- **Runtime**: Python 3.12
- **Framework**: FastAPI (async, routers por domínio)
- **ORM**: SQLAlchemy 2.x (async) + Alembic (migrations)
- **Task queue**: Celery + Redis (sync periódico com Pluggy, webhooks)
- **Validação**: Pydantic v2
- **Auth**: JWT (access token 15min + refresh token 7d) — bcrypt para senhas

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Estilo**: Tailwind CSS + shadcn/ui (componentes base)
- **State**: TanStack Query (server state) + Zustand (UI state)
- **Gráficos**: Recharts
- **Formulários**: React Hook Form + Zod
- **Roteamento**: React Router v6

### Infra (Docker)
- **Banco**: PostgreSQL 16
- **Cache/Queue broker**: Redis 7
- **Reverse proxy**: Nginx (SSL termination, static files, proxy para API)
- **AI**: Claude API (claude-haiku-4-5-20251001 para parsing rápido; claude-sonnet-5 para análise)
- **Open Finance**: Pluggy.ai (aggregador Open Finance Brasil)

### Containerização
```
nginx          (80/443)  — proxy + static frontend
web            (3000)    — React app (só em dev; em prod nginx serve o build)
api            (8000)    — FastAPI
worker         (—)       — Celery worker (sync Pluggy, relatórios assíncronos)
beat           (—)       — Celery beat (scheduler periódico)
postgres       (5432)    — banco principal
redis          (6379)    — broker + cache
```

---

## ESTRUTURA DE PASTAS

```
financeai/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .env                         ← gerado pelo usuário (não commitar)
├── infra/
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── ssl/                 ← certificados (auto-assinado para dev, Let's Encrypt para prod)
│   └── postgres/
│       └── init.sql             ← extensões e configurações iniciais
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── alembic/
│   │   │   ├── env.py
│   │   │   └── versions/
│   │   └── app/
│   │       ├── main.py          ← FastAPI app factory
│   │       ├── core/
│   │       │   ├── config.py    ← settings via pydantic-settings
│   │       │   ├── database.py  ← async engine + session
│   │       │   ├── redis.py
│   │       │   ├── security.py  ← JWT, bcrypt
│   │       │   └── celery_app.py
│   │       ├── models/          ← SQLAlchemy models (um arquivo por domínio)
│   │       ├── schemas/         ← Pydantic schemas
│   │       ├── routers/         ← FastAPI routers
│   │       ├── services/        ← lógica de negócio
│   │       ├── tasks/           ← Celery tasks
│   │       └── integrations/
│   │           ├── pluggy.py    ← cliente Pluggy SDK
│   │           └── claude.py    ← cliente Anthropic SDK
│   └── web/
│       ├── Dockerfile
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/
│           │   ├── ui/          ← shadcn/ui components
│           │   └── shared/      ← componentes compartilhados
│           ├── pages/
│           ├── hooks/
│           ├── stores/
│           ├── lib/
│           │   ├── api.ts       ← axios instance configurada
│           │   └── utils.ts
│           └── types/
```

---

## VARIÁVEIS DE AMBIENTE (.env.example)

```dotenv
# ── Banco de Dados ──────────────────────────
DATABASE_URL=postgresql+asyncpg://financeai:senha@postgres:5432/financeai

# ── Redis ────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── Segredos da aplicação ────────────────────
SECRET_KEY=troque-por-64-bytes-aleatorios-hex
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── Pluggy (Open Finance Brasil) ─────────────
# Obter em: https://dashboard.pluggy.ai
PLUGGY_CLIENT_ID=seu-client-id-aqui
PLUGGY_CLIENT_SECRET=seu-client-secret-aqui
PLUGGY_WEBHOOK_SECRET=webhook-secret-aleatorio

# ── Anthropic (IA) ────────────────────────────
# Obter em: https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# ── App ───────────────────────────────────────
ENVIRONMENT=development          # development | production
APP_NAME=FinanceAI
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:8000
SYNC_INTERVAL_HOURS=6            # frequência de sync automático com Pluggy

# ── Celery ───────────────────────────────────
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# ── Usuário admin inicial (seed) ─────────────
ADMIN_EMAIL=admin@financeai.local
ADMIN_PASSWORD=troque-esta-senha

# ── TZ ───────────────────────────────────────
TZ=America/Sao_Paulo
```

---

## MÓDULOS A IMPLEMENTAR (em ordem)

---

### MÓDULO 1 — Base da Infraestrutura

**Objetivo**: containers funcionando, API e frontend se comunicando.

#### Tasks:
1. Criar `docker-compose.yml` com todos os serviços:
   - `postgres`, `redis`, `api`, `worker`, `beat`, `web`, `nginx`
   - Volumes nomeados para postgres e redis
   - Health checks em postgres e redis
   - `api` e `worker` dependem de postgres e redis estarem healthy
   - `web` depende da `api`
   - Rede interna `financeai-net`

2. Criar `docker-compose.prod.yml` com overrides:
   - `web` não roda (nginx serve o build estático)
   - `api` com `--workers 4 --worker-class uvicorn.workers.UvicornWorker`
   - Sem bind de portas internas ao host (apenas nginx expõe 80/443)

3. **FastAPI app factory** (`apps/api/app/main.py`):
   - CORS configurado para `FRONTEND_URL`
   - Middleware de logging estruturado (JSON)
   - Router `/health` retorna `{"status": "ok", "db": "ok", "redis": "ok"}`
   - Lifespan: conexão com DB e Redis ao iniciar, fechar ao desligar

4. **Nginx** (`infra/nginx/nginx.conf`):
   - Dev: proxy `/api/` → `http://api:8000/`, `/` → `http://web:3000/`
   - Prod: proxy `/api/` → `http://api:8000/`, `/` → pasta `/dist` (build React)
   - Headers de segurança: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin`

5. **React base**:
   - Instalar: `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `recharts`, `react-hook-form`, `zod`
   - Instalar shadcn/ui base: `button`, `card`, `input`, `label`, `select`, `dialog`, `sheet`, `badge`, `avatar`, `skeleton`, `toast`
   - Tema: dark por padrão com toggle claro/escuro (next-themes ou CSS variables)
   - Rota `/health` no frontend confirma conexão com API

#### Health check do módulo:
```bash
docker compose up -d
curl http://localhost/api/health    # deve retornar {"status":"ok","db":"ok","redis":"ok"}
curl http://localhost               # deve retornar o React app
```

---

### MÓDULO 2 — Autenticação e Usuários

**Objetivo**: login, registro, JWT com refresh, perfil de usuário.

#### Modelo de dados:
```sql
-- users
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
email VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR NOT NULL
name VARCHAR(255) NOT NULL
avatar_url VARCHAR
privacy_mode BOOLEAN DEFAULT FALSE      -- modo privacidade ativo/inativo persistido
ai_personality VARCHAR(20) DEFAULT 'neutro'  -- neutro | direto | motivador
currency VARCHAR(10) DEFAULT 'BRL'
timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo'
is_active BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### Endpoints da API:
```
POST /api/v1/auth/register    — cria usuário, retorna tokens
POST /api/v1/auth/login       — email+senha, retorna access+refresh tokens
POST /api/v1/auth/refresh     — troca refresh token por novo access token
POST /api/v1/auth/logout      — invalida refresh token (blacklist no Redis)
GET  /api/v1/users/me         — perfil do usuário autenticado
PUT  /api/v1/users/me         — atualiza nome, ai_personality, privacy_mode
PUT  /api/v1/users/me/password — troca senha (requer senha atual)
```

#### Frontend:
- Páginas: `/login`, `/register`, `/settings` (aba Perfil)
- Layout base com sidebar + topbar após login
- Topbar: botão de toggle privacidade (ícone olho), toggle tema, menu do usuário (nome + logout)
- Sidebar: links para todos os módulos (ícone + label, colapsável no mobile)
- Modo privacidade: quando ativo, todos os valores monetários renderizam como `•••••` — implementar via store Zustand `usePrivacyStore` e componente wrapper `<PrivacyValue value={150} />`
- **Command palette** (`Cmd+K` / `Ctrl+K`): busca nas rotas da sidebar, navega com Enter

#### Personalidade da IA (campo `ai_personality`):
```
neutro    → responde de forma objetiva e direta, sem julgamentos
direto    → curto, sem rodeios, foca em números e ações
motivador → tom positivo e encorajador, usa emojis sutis
```
Este campo é passado ao Claude em cada chamada de IA no system prompt.

#### Health check:
```bash
# Registrar usuário
curl -X POST http://localhost/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"senha123","name":"Teste"}'

# Login e salvar token
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"senha123"}' | jq -r '.access_token')

# Acessar perfil
curl http://localhost/api/v1/users/me -H "Authorization: Bearer $TOKEN"
```

---

### MÓDULO 3 — Open Finance: Conexão com Bancos (Pluggy)

> **Este é o módulo central e diferencial do produto.**

#### O que é Pluggy
Pluggy (pluggy.ai) é um agregador de dados financeiros que implementa o protocolo Open Finance Brasil, cobrindo mais de 300 instituições (Nubank, Itaú, Bradesco, Santander, XP, Inter, etc.). O fluxo é:
1. API Pluggy gera um `connect_token` temporário (TTL 30min)
2. Frontend abre o **Pluggy Connect Widget** (iframe/popup) com esse token
3. Usuário escolhe banco, autentica com credenciais bancárias (não vemos as credenciais)
4. Pluggy cria um `item` (conexão) e retorna um `item_id`
5. Pluggy sincroniza automaticamente e notifica via webhook
6. Nossa API usa `item_id` para buscar contas, transações, faturas, investimentos

**Docs Pluggy**: https://docs.pluggy.ai

#### Modelos de dados:
```sql
-- bank_connections (items Pluggy)
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
pluggy_item_id VARCHAR(50) UNIQUE NOT NULL
institution_id INTEGER NOT NULL      -- ID da instituição no Pluggy
institution_name VARCHAR(255) NOT NULL
institution_logo_url VARCHAR
status VARCHAR(20) NOT NULL          -- UPDATING | UPDATED | LOGIN_ERROR | OUTDATED
last_sync_at TIMESTAMPTZ
error_message TEXT
created_at TIMESTAMPTZ DEFAULT NOW()

-- bank_accounts (accounts Pluggy)
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
connection_id UUID REFERENCES bank_connections(id)
pluggy_account_id VARCHAR(50) UNIQUE NOT NULL
name VARCHAR(255) NOT NULL
type VARCHAR(30) NOT NULL            -- BANK | CREDIT | INVESTMENT
subtype VARCHAR(30)                  -- CHECKING | SAVINGS | CREDIT_CARD | etc.
number VARCHAR(50)                   -- últimos 4 dígitos
currency VARCHAR(10) DEFAULT 'BRL'
balance NUMERIC(15,2) DEFAULT 0
credit_limit NUMERIC(15,2)           -- apenas cartões
available_credit NUMERIC(15,2)
due_date DATE                        -- vencimento da fatura
is_active BOOLEAN DEFAULT TRUE
last_sync_at TIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### Endpoints da API:
```
POST /api/v1/open-finance/connect-token
    — gera connect_token do Pluggy para abrir o widget
    — response: { connect_token: "...", expires_in: 1800 }

POST /api/v1/open-finance/webhook
    — recebe eventos do Pluggy (ITEM_UPDATED, ITEM_ERROR, etc.)
    — valida assinatura HMAC (PLUGGY_WEBHOOK_SECRET)
    — dispara task Celery de sync

GET  /api/v1/open-finance/connections
    — lista conexões bancárias do usuário com status e última sync

DELETE /api/v1/open-finance/connections/{id}
    — desconecta banco (revoga consentimento no Pluggy + soft-delete local)

POST /api/v1/open-finance/connections/{id}/sync
    — dispara sync manual de uma conexão

GET  /api/v1/bank-accounts
    — lista contas bancárias do usuário (todas as conexões)
    — inclui saldo, limite, última sync

GET  /api/v1/bank-accounts/summary
    — saldo total, limite total de cartões, crédito disponível total
```

#### Celery Tasks (sync):
```python
# tasks/pluggy_sync.py

@shared_task
def sync_connection(connection_id: str):
    """
    Para cada connection_id:
    1. Busca accounts via Pluggy API
    2. Upsert em bank_accounts (por pluggy_account_id)
    3. Para cada account, busca transactions dos últimos 90 dias
    4. Upsert em transactions com origem='open_finance'
    5. Chama reconciliation_service para detectar duplicidades
    6. Atualiza connection.status e last_sync_at
    """

@shared_task
def sync_all_connections():
    """Roda a cada SYNC_INTERVAL_HOURS pelo beat — sincroniza todas as conexões ativas."""
```

#### Frontend — Tela de Contas (`/accounts`):
- Lista de conexões com logo do banco, nome, status (badge colorido), última sync
- Botão "Conectar banco" → abre Pluggy Connect Widget em modal
- O widget Pluggy é carregado via `<script src="https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js">`
- Após sucesso do widget: POST para `/api/v1/open-finance/webhook` (ou endpoint dedicado) com o `item_id`
- Botão "Sincronizar agora" por conexão + "Reconectar" quando status LOGIN_ERROR
- Lista de contas por banco com saldo, número mascarado e tipo
- Summary bar no topo: saldo total, limite total, crédito disponível

#### Serviço de Reconciliação:
```python
# services/reconciliation.py

def reconcile_transaction(user_id, pluggy_tx) -> Transaction | None:
    """
    Verifica se já existe transação manual ou importada via CSV
    com mesmo valor, data (+/- 3 dias) e descrição similar (fuzzy match >85%).
    Se sim: marca a existente como reconciliada, não cria duplicata.
    Se não: cria nova transação com origem='open_finance'.
    """
```

#### Health check:
```bash
# Deve retornar connect_token
curl -X POST http://localhost/api/v1/open-finance/connect-token \
  -H "Authorization: Bearer $TOKEN"
```

---

### MÓDULO 4 — Transações

**Objetivo**: CRUD completo de transações (manual, Open Finance, CSV), com categorização por IA.

#### Modelo de dados:
```sql
-- categories
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id) NULL  -- NULL = categoria do sistema
name VARCHAR(100) NOT NULL
icon VARCHAR(50)                         -- emoji ou nome de ícone
color VARCHAR(7)                         -- hex
type VARCHAR(10) NOT NULL                -- expense | income | both
is_active BOOLEAN DEFAULT TRUE

-- transactions
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
account_id UUID REFERENCES bank_accounts(id) NULL  -- null se lançamento manual sem conta vinculada
category_id UUID REFERENCES categories(id) NULL
description TEXT NOT NULL
amount NUMERIC(15,2) NOT NULL            -- sempre positivo; tipo define direção
type VARCHAR(10) NOT NULL                -- expense | income | investment | transfer
date DATE NOT NULL
notes TEXT
origin VARCHAR(20) DEFAULT 'manual'      -- manual | open_finance | csv_import
pluggy_transaction_id VARCHAR(100) UNIQUE NULL  -- para transações do Open Finance
is_reconciled BOOLEAN DEFAULT FALSE      -- marcado pelo serviço de reconciliação
is_recurring BOOLEAN DEFAULT FALSE
recurring_id UUID REFERENCES recurring_transactions(id) NULL
ai_suggested_category_id UUID NULL       -- categoria sugerida pela IA antes da confirmação
ai_confidence FLOAT NULL                 -- 0.0-1.0
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()

-- recurring_transactions
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
description TEXT NOT NULL
amount NUMERIC(15,2) NOT NULL
type VARCHAR(10) NOT NULL
category_id UUID REFERENCES categories(id) NULL
frequency VARCHAR(20) NOT NULL           -- daily | weekly | monthly | yearly
day_of_month INTEGER NULL                -- 1-28 para monthly
start_date DATE NOT NULL
end_date DATE NULL
last_generated_at DATE NULL
is_active BOOLEAN DEFAULT TRUE
```

#### Categorias do sistema (seed):
```
expense: Alimentação, Assinaturas, Beleza, Casa, Combustível, Educação,
         Entretenimento, Lazer, Moradia, Pets, Roupas, Saúde, Seguros,
         Serviços, Taxas Bancárias, Transporte, Viagem
income:  Salário, Freelance, Investimentos, Reembolso, Outros
both:    Transferência
```

#### Endpoints:
```
GET    /api/v1/transactions                  — listagem com filtros e paginação
POST   /api/v1/transactions                  — criar transação manual
POST   /api/v1/transactions/parse            — parsing por IA (ver abaixo)
GET    /api/v1/transactions/{id}
PUT    /api/v1/transactions/{id}
DELETE /api/v1/transactions/{id}
POST   /api/v1/transactions/import-csv       — importação em lote
GET    /api/v1/transactions/export-csv       — exportação com filtros

GET    /api/v1/categories                    — categorias (sistema + usuário)
POST   /api/v1/categories                    — criar categoria personalizada
PUT    /api/v1/categories/{id}
DELETE /api/v1/categories/{id}

GET    /api/v1/recurring                     — transações recorrentes
POST   /api/v1/recurring
PUT    /api/v1/recurring/{id}
DELETE /api/v1/recurring/{id}
```

#### Endpoint de parsing por IA:
```
POST /api/v1/transactions/parse
Body: { "text": "gastei 150 no almoço de negócios com cliente sexta" }

Response:
{
  "description": "Almoço de negócios com cliente",
  "amount": 150.00,
  "type": "expense",
  "category_id": "<uuid de Alimentação>",
  "category_name": "Alimentação",
  "date": "2025-07-04",         // sexta anterior inferida
  "confidence": 0.95,
  "alternatives": [             // outras categorias possíveis
    { "category_name": "Trabalho", "confidence": 0.4 }
  ]
}
```

**Implementação do parsing** (`integrations/claude.py`):
```python
async def parse_transaction(text: str, user_categories: list, user_personality: str) -> ParsedTransaction:
    client = anthropic.AsyncAnthropic()
    
    system = f"""Você é um assistente financeiro pessoal com personalidade '{user_personality}'.
Analise o texto do usuário e extraia os dados da transação financeira.
Categorias disponíveis: {json.dumps(user_categories)}
Data atual: {date.today().isoformat()} (fuso: America/Sao_Paulo)
Responda SOMENTE com JSON válido, sem markdown."""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",  # rápido e barato para parsing
        max_tokens=500,
        system=system,
        messages=[{"role": "user", "content": text}]
    )
    return ParsedTransaction.model_validate_json(message.content[0].text)
```

#### Frontend — Tela de Transações (`/transactions`):
- Lista com paginação infinita ou por página (50 itens)
- Filtros: tipo, conta, categoria, período (datepicker range), origem (manual/open_finance/csv), texto livre
- Cada linha: ícone da categoria, descrição, conta, valor (colorido: verde=receita, vermelho=despesa), data, badge de origem
- Badge especial para transações com `ai_suggested_category` (não confirmada): "Categorizada por IA - confirmar?"
- Botão "Nova transação": abre modal com campo de texto livre no topo ("Descreva o gasto...") que usa o endpoint `/parse` antes de exibir o formulário completo
- Formulário completo: description, amount, type, category (com ícone), account (optional), date, notes, recurring toggle
- Importar CSV: modal com upload, mapeamento de colunas, preview de 5 linhas, botão confirmar
- Exportar: gera CSV com filtros atuais aplicados

---

### MÓDULO 5 — Dashboard

**Objetivo**: visão executiva consolidada do período, com dados reais do Open Finance.

#### Endpoint:
```
GET /api/v1/dashboard/summary?period=current_month&compare=previous_month
Response:
{
  "period": { "start": "2025-07-01", "end": "2025-07-07" },
  "total_income": 8500.00,
  "total_expenses": 3240.00,
  "savings_rate": 0.619,
  "net_balance": 5260.00,
  "total_bank_balance": 12840.00,       // soma de todas as contas correntes
  "total_credit_limit": 30000.00,
  "total_credit_available": 21500.00,
  "expenses_by_category": [
    { "category": "Alimentação", "amount": 890.00, "percentage": 27.5, "vs_previous": +12.3 }
  ],
  "daily_spending": [
    { "date": "2025-07-01", "expenses": 320.00, "income": 0 }
  ],
  "recent_transactions": [...],         // últimas 10
  "open_finance_accounts": [...],       // resumo das contas conectadas
  "alerts": [                           // alertas proativos
    { "type": "budget_warning", "message": "Alimentação 87% do orçamento atingido" }
  ]
}
```

#### Frontend — Dashboard (`/`):
Layout de grid responsivo:

```
[Saldo Total Banco]  [Receitas do mês]  [Despesas do mês]  [Taxa de Economia]
[Contas Open Finance — lista com logo, saldo, status]
[Gráfico de evolução diária — Recharts LineChart comparando mês atual vs anterior]
[Top categorias de despesa — barras horizontais com variação %]
[Últimas transações — tabela compacta]
[Alertas proativos — cards coloridos por tipo]
```

**Cartões Open Finance** no dashboard:
- Logo da instituição (URL do Pluggy)
- Saldo (com `<PrivacyValue />`)
- Status da sync (última atualização "há X minutos")
- Dot colorido: verde=OK, amarelo=sincronizando, vermelho=erro

**Alertas proativos** (gerados no backend, não por IA):
- Gasto de categoria atingiu >80% da meta definida
- Fatura com vencimento em ≤3 dias
- Saldo de conta negativo
- Transação ≥3x o ticket médio da categoria (anomalia)
- Conexão bancária com erro de login

#### Seletor de período:
`Últimos 7 dias | Mês atual | Mês anterior | Este ano | Personalizado`

---

### MÓDULO 6 — Chat de IA Financeiro

**Objetivo**: assistente conversacional que acessa dados reais do usuário para responder perguntas financeiras.

#### Modelo de dados:
```sql
-- chat_conversations
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
title VARCHAR(255)                -- gerado automaticamente da primeira pergunta
created_at TIMESTAMPTZ DEFAULT NOW()

-- chat_messages
id UUID PRIMARY KEY
conversation_id UUID REFERENCES chat_conversations(id)
role VARCHAR(10) NOT NULL          -- user | assistant
content TEXT NOT NULL
metadata JSONB NULL                -- dados usados pela IA (para debug/transparência)
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### Endpoint:
```
GET  /api/v1/chat/conversations
POST /api/v1/chat/conversations                  — inicia nova conversa
GET  /api/v1/chat/conversations/{id}/messages
POST /api/v1/chat/conversations/{id}/messages    — envia mensagem (streaming SSE)
DELETE /api/v1/chat/conversations/{id}
```

#### Implementação — Context injection:
```python
# services/chat_service.py

async def build_financial_context(user_id: str, period_days: int = 30) -> dict:
    """
    Monta o contexto financeiro atual do usuário para injetar no prompt.
    Cobre: saldo por conta, resumo de gastos por categoria, metas ativas,
    top 5 maiores despesas do período, alertas ativos.
    """
    return {
        "current_date": date.today().isoformat(),
        "accounts_summary": [...],
        "period_expenses_by_category": [...],
        "period_income_total": ...,
        "period_expense_total": ...,
        "active_goals": [...],
        "recent_alerts": [...]
    }

async def chat(conversation_id, user_message, user) -> AsyncIterator[str]:
    context = await build_financial_context(user.id)
    personality_prompt = PERSONALITY_PROMPTS[user.ai_personality]
    
    system = f"""{personality_prompt}
    
Você é um assistente financeiro pessoal do usuário {user.name}.
Você tem acesso aos dados financeiros atuais dele:

{json.dumps(context, ensure_ascii=False, indent=2)}

Responda perguntas sobre suas finanças de forma precisa, baseada apenas nos dados acima.
Se precisar de dados fora do período disponível, informe que não tem acesso.
Formate valores sempre em R$ com duas casas decimais.
Nunca invente dados — se não souber, diga que não tem a informação disponível."""

    # Streaming com Claude
    with anthropic_client.messages.stream(
        model="claude-sonnet-5",
        max_tokens=1500,
        system=system,
        messages=history + [{"role": "user", "content": user_message}]
    ) as stream:
        for text in stream.text_stream:
            yield text
```

#### Frontend — Chat (`/chat`):
- Painel lateral deslizável (sheet) OU página própria em `/chat`
- Lista de conversas na sidebar esquerda do chat
- Área de mensagens com markdown rendering (react-markdown)
- Input na base com streaming (SSE — texto aparece palavra a palavra)
- Sugestões de perguntas ao abrir nova conversa:
  - "Quanto gastei em alimentação este mês?"
  - "Quais são minhas maiores despesas recorrentes?"
  - "Estou no caminho certo para minha meta de [meta ativa]?"
  - "Faça um resumo financeiro da minha semana"
- Botão "Nova conversa" sempre visível
- Timestamp e modelo usado em cada resposta (pequeno, cinza)

---

### MÓDULO 7 — Metas e Orçamentos

**Objetivo**: definir limites de gasto por categoria e objetivos de poupança; acompanhar automaticamente.

#### Modelo de dados:
```sql
-- goals
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
name VARCHAR(255) NOT NULL
type VARCHAR(20) NOT NULL           -- expense_limit | income_target | savings | investment
category_id UUID REFERENCES categories(id) NULL  -- para expense_limit
target_amount NUMERIC(15,2) NOT NULL
current_amount NUMERIC(15,2) DEFAULT 0   -- calculado periodicamente
period VARCHAR(20) DEFAULT 'monthly'     -- monthly | yearly | one_time
deadline DATE NULL                       -- para goals one_time
is_active BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### Endpoint:
```
GET    /api/v1/goals
POST   /api/v1/goals
PUT    /api/v1/goals/{id}
DELETE /api/v1/goals/{id}
GET    /api/v1/goals/progress         — progresso de todas as metas no período atual
```

#### Frontend — Metas (`/goals`):
- Cards por meta: nome, progresso (barra horizontal), valor atual vs target, categoria
- Cor da barra: verde (<60%), amarelo (60-80%), vermelho (>80%)
- Modal de criação: nome, tipo, categoria (se expense_limit), valor alvo, período
- Stats no topo: X metas ativas, total orçado vs gasto

---

### MÓDULO 8 — Relatórios e Análise Financeira por IA

**Objetivo**: relatórios históricos + análise narrativa gerada pelo Claude.

#### Endpoints:
```
GET /api/v1/reports/monthly?year=2025&month=7   — dados estruturados do mês
GET /api/v1/reports/yearly?year=2025            — dados do ano completo
GET /api/v1/reports/category/{id}?period=...    — histórico de uma categoria
POST /api/v1/reports/ai-analysis               — gera análise narrativa (async, retorna job_id)
GET  /api/v1/reports/ai-analysis/{job_id}      — status + resultado da análise
```

#### Análise por IA (Celery task):
```python
@shared_task
def generate_ai_analysis(user_id: str, period_start: str, period_end: str) -> str:
    """
    Monta contexto completo do período (gastos, receitas, comparativo, metas, tendências).
    Envia ao Claude Sonnet para gerar análise narrativa personalizada.
    Persiste resultado e notifica frontend via Redis pub/sub ou polling.
    """
    # Prompt de análise usa claude-sonnet-5 com até 4096 tokens
    # Saída: markdown com seções — Resumo, Destaques, Pontos de Atenção, Recomendações
```

#### Frontend — Relatórios (`/reports`):
- Seletor de período (mês/ano)
- Gráficos: pizza de categorias, barras mensais comparativas, linha de saldo
- Tabela de categorias com variação vs período anterior
- Botão "Gerar análise com IA" → loading animado → exibe texto em markdown
- Export: botão CSV (dados) + botão Imprimir (abre `window.print()`)

---

### MÓDULO 9 — Calculadoras Financeiras

**Objetivo**: ferramentas de planejamento que usam dados reais do usuário para pré-preencher campos.

**Calculadoras a implementar:**

#### 1. Juros Compostos
- Campos: capital inicial, aporte mensal, taxa de juros (%a.m. ou %a.a.), prazo
- Pré-preenche "aporte mensal" com taxa média de poupança do usuário (da análise)
- Resultado: valor final, juros ganhos, gráfico de evolução (Recharts AreaChart)

#### 2. Fundo de Emergência
- Campos: despesas mensais fixas, meses de cobertura desejados (3, 6, 12)
- Pré-preenche despesas fixas com média real dos últimos 3 meses
- Resultado: valor ideal do fundo, quanto falta, prazo sugerido para atingir

#### 3. Independência Financeira
- Campos: despesas mensais atuais, rendimento esperado da carteira (%a.a.)
- Pré-preenche com média de gastos reais
- Resultado: patrimônio necessário (regra dos 4%), prazo estimado dado taxa de poupança atual

#### Frontend (`/calculators`):
- Tabs para cada calculadora
- Formulários com toggle "Usar meus dados reais" (pré-preenchimento)
- Gráficos para cada calculadora
- "Salvar resultado como meta" → cria entrada em `/goals`

---

### MÓDULO 10 — Investimentos

**Objetivo**: visão do patrimônio investido, separado das despesas correntes.

#### Modelo:
```sql
-- investments
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
account_id UUID REFERENCES bank_accounts(id) NULL   -- conta Open Finance (se sincronizado)
name VARCHAR(255) NOT NULL
type VARCHAR(50) NOT NULL                            -- renda_fixa | renda_variavel | fundo | cripto | outro
institution VARCHAR(255)
quantity NUMERIC(20,8) DEFAULT 1
unit_price NUMERIC(15,6)
current_value NUMERIC(15,2) NOT NULL
invested_amount NUMERIC(15,2) NOT NULL
income NUMERIC(15,2) GENERATED ALWAYS AS (current_value - invested_amount) STORED
income_percentage NUMERIC(10,4)
last_updated TIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### Frontend (`/investments`):
- Cards: patrimônio total, rendimento total, rendimento %, quantidade de ativos
- Gráfico de pizza por tipo de ativo
- Lista de ativos com variação colorida
- Contas Open Finance com tipo INVESTMENT aparecem aqui automaticamente (sincronizadas via Pluggy)
- Formulário de lançamento manual de ativo

---

## REGRAS TÉCNICAS — SEMPRE APLICAR

### Segurança
- **Row-Level Security conceitual**: todo query filtra por `user_id` — nunca retornar dados de outro usuário
- Senhas: bcrypt com cost factor 12
- Tokens JWT: `RS256` ou `HS256` com secret de 256 bits mínimo
- Inputs: sanitizar e limitar tamanho em todos os endpoints
- Rate limiting no Nginx: `limit_req_zone` por IP em `/api/v1/auth/`
- Headers de segurança no Nginx: CSP, HSTS, X-Frame-Options

### Performance
- Índices obrigatórios: `transactions(user_id, date)`, `transactions(user_id, category_id)`, `transactions(pluggy_transaction_id)`, `bank_connections(pluggy_item_id)`
- Paginação em todos os endpoints de listagem (padrão: 50 itens, máximo: 200)
- Cache Redis: contexto financeiro para o chat (TTL 5min), summary do dashboard (TTL 2min)
- Lazy loading de módulos no React (React.lazy + Suspense)

### Qualidade de código
- Todos os models SQLAlchemy com `__tablename__`, relacionamentos declarados
- Schemas Pydantic separados: `Create`, `Update`, `Response` por entidade
- Services isolados dos routers — lógica de negócio nunca no router
- Variáveis de ambiente lidas apenas em `app/core/config.py` (Settings com pydantic-settings)
- Erros da API: sempre `{"detail": "mensagem legível"}` com HTTP status correto

### Banco de Dados
- Migrations via Alembic — nunca alterar tabelas manualmente
- Soft-delete (`is_active`) para conexões e contas (preservar histórico)
- Timestamps: sempre `TIMESTAMPTZ`, nunca `TIMESTAMP`
- IDs: sempre `UUID` via `gen_random_uuid()`

---

## FLUXO DE DESENVOLVIMENTO

Implemente na ordem dos módulos. Antes de avançar de um módulo para o próximo:

1. Verifique que o Docker compose sobe sem erros: `docker compose up -d`
2. Rode as migrations: `docker compose exec api alembic upgrade head`
3. Execute o health check do módulo
4. Confirme visualmente no browser que a tela do módulo funciona
5. Diga "Módulo X concluído — pode prosseguir"

---

## GUIA DE SETUP INICIAL (executar uma vez)

```bash
# 1. Clonar / entrar na pasta
mkdir financeai && cd financeai

# 2. Criar .env a partir do exemplo
cp .env.example .env
# → editar .env com chaves reais (Pluggy, Anthropic)

# 3. Subir pela primeira vez
docker compose up -d --build

# 4. Aguardar postgres ficar healthy (~10s)
docker compose ps

# 5. Rodar migrations
docker compose exec api alembic upgrade head

# 6. Rodar seed (categorias do sistema + usuário admin)
docker compose exec api python -m app.scripts.seed

# 7. Verificar
curl http://localhost/api/health
# Acessar http://localhost no browser
```

---

## COMO EXECUTAR OS MÓDULOS

```
"Implemente o Módulo 1 — Base da Infraestrutura"
"Implemente o Módulo 2 — Autenticação e Usuários"
"Implemente o Módulo 3 — Open Finance (Pluggy)"
"Implemente o Módulo 4 — Transações"
"Implemente o Módulo 5 — Dashboard"
"Implemente o Módulo 6 — Chat de IA Financeiro"
"Implemente o Módulo 7 — Metas e Orçamentos"
"Implemente o Módulo 8 — Relatórios e Análise por IA"
"Implemente o Módulo 9 — Calculadoras Financeiras"
"Implemente o Módulo 10 — Investimentos"
```

Após cada módulo, exemplos de ajustes que você pode pedir:
- `"No Módulo 3, adicionar sincronização de faturas de cartão"`
- `"No chat, adicionar sugestões de perguntas baseadas nos alertas ativos"`
- `"No dashboard, adicionar gráfico de fluxo de caixa (Sankey)"`
- `"Adicionar suporte a múltiplos usuários (família) no Módulo 2"`
