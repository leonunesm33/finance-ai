-- Extensões necessárias para o FinanceAI
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy match (reconciliação de transações)

SET timezone = 'America/Sao_Paulo';
