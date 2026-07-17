# Deploy — FinanceAI

## Desenvolvimento (WSL)

```bash
docker-compose up -d --build
```

- Entrada única no browser: **http://localhost** (nginx). A porta 3000 é o Vite dev sem proxy de `/api` — não use direto.
- API direta (debug): http://localhost:8001 · Swagger em `/docs`.
- Testes: `docker exec financeai-api python -m pytest tests -v`
- Lint/build web: `docker exec financeai-web npm run lint` / `npm run build`
- Se recriar o container da API, reinicie o nginx (`docker restart financeai-nginx`) — ele cacheia o IP antigo e responde 502.

## Produção

1. Preencha o `.env` com valores reais (nunca commitá-lo):
   - `ENVIRONMENT=production` — a API **recusa subir** com SECRET_KEY/senhas placeholder (fail-fast).
   - `POSTGRES_PASSWORD` forte (e `DATABASE_URL` coerente) **antes** do primeiro `up` (o volume do Postgres é inicializado com essa senha).
   - `FRONTEND_URL=https://seu-dominio`.
   - **IA**: `AI_PROVIDER` (padrão `openrouter`) + a chave correspondente (`OPENROUTER_API_KEY`, ou `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GEMINI_API_KEY`/`GROQ_API_KEY`) e os modelos `AI_CHAT_MODEL`/`AI_PARSE_MODEL`/`AI_ANALYSIS_MODEL`. Sem chave, os recursos de IA respondem 503 e o resto do app funciona.
   - **Open Finance**: fica **desligado** (`OPEN_FINANCE_ENABLED=false`). Para ligar no futuro: `OPEN_FINANCE_ENABLED=true`, `OPEN_FINANCE_PROVIDER` (pluggy | polp | belvo | celcoin) e as credenciais do provedor (Pluggy: `PLUGGY_CLIENT_ID/SECRET` + `PLUGGY_WEBHOOK_SECRET` — o webhook responde 503/401 fail-closed).
2. Gere o build estático do frontend (o nginx de produção serve `apps/web/dist`):
   ```bash
   docker-compose run --rm web npm run build
   ```
3. Suba com o override de produção (gunicorn 4 workers, sem bind mounts, web dev desligado):
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
4. Migrações: `docker exec financeai-api alembic upgrade head`
5. TLS: coloque `fullchain.pem`/`privkey.pem` em `infra/nginx/ssl/` e adicione o bloco `listen 443 ssl` no `nginx.prod.conf` (ou use um proxy externo tipo Caddy/Traefik/Cloudflare).
6. Webhook Pluggy: registre `https://seu-dominio/api/v1/open-finance/webhook` no dashboard da Pluggy com o mesmo `PLUGGY_WEBHOOK_SECRET`.

## Segurança já embutida

- JWT: access 15 min em memória no cliente; refresh 7 dias em cookie httpOnly `SameSite=Strict` (Secure em produção) com blacklist no Redis.
- Rate-limit no nginx: login (10 r/m) e chat IA (20 r/m) por IP.
- SSE do chat com `proxy_buffering off` (streaming real).
- Containers da API rodam como usuário não-root (uid 1000).
- CSP em produção liberando apenas a Pluggy (cdn/connect/api.pluggy.ai).
