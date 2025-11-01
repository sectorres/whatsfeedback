# 🐳 Executar WhatsFeedback com Docker

Este guia simplifica a execução do projeto usando Docker e Docker Compose.

## 📋 Pré-requisitos

- **Docker** (versão 20.10+)
- **Docker Compose** (versão 2.0+)

[Instalar Docker](https://docs.docker.com/get-docker/)

## 🚀 Início Rápido

### 1. Clone ou baixe o projeto

```bash
git clone <url-do-repositorio>
cd <nome-do-projeto>
```

### 2. Configure as variáveis de ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o .env conforme necessário
nano .env  # ou use seu editor preferido
```

### 3. Execute o projeto

**Opção A: Usar Supabase do Lovable Cloud (Recomendado)**
```bash
# Apenas suba o frontend
docker-compose up app
```

O projeto estará disponível em: `http://localhost:3000`

**Opção B: Executar tudo localmente (Frontend + Supabase)**
```bash
# Suba todos os serviços
docker-compose up -d

# Aguarde alguns segundos para inicialização
# Acesse:
# - Frontend: http://localhost:3000
# - Supabase Studio: http://localhost:54323
# - Supabase API: http://localhost:54321
```

### 4. Parar os serviços

```bash
docker-compose down
```

Para remover também os volumes (dados do banco):
```bash
docker-compose down -v
```

## 🔧 Configurações

### Usando Supabase do Lovable Cloud

Mantenha no `.env`:
```env
VITE_SUPABASE_URL=https://netzgkrlmoqsnvckzbkh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=netzgkrlmoqsnvckzbkh
```

Execute apenas:
```bash
docker-compose up app
```

### Usando Supabase Local

Altere no `.env`:
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<chave-local-gerada>
POSTGRES_PASSWORD=your-super-secret-password
```

Execute todos os serviços:
```bash
docker-compose up -d
```

## 📦 Serviços Disponíveis

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| app | 3000 | Frontend (React/Vite) |
| supabase-db | 5432 | PostgreSQL Database |
| supabase-api | 54321 | Supabase REST API |
| supabase-studio | 54323 | Interface de gerenciamento do banco |

## 🛠️ Comandos Úteis

```bash
# Ver logs dos serviços
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f app

# Reconstruir as imagens
docker-compose build --no-cache

# Executar comandos dentro do container
docker-compose exec app sh

# Ver status dos serviços
docker-compose ps

# Parar um serviço específico
docker-compose stop app
```

## 🔄 Rebuild após mudanças no código

```bash
# Parar os serviços
docker-compose down

# Reconstruir e iniciar
docker-compose up --build
```

## 📝 Notas Importantes

### Edge Functions
- **Com Lovable Cloud**: Edge Functions funcionam automaticamente
- **Supabase Local**: Você precisará configurar e deployar as Edge Functions manualmente usando o Supabase CLI

### Migrações de Banco
- As migrações em `supabase/migrations/` são aplicadas automaticamente quando o banco inicializa pela primeira vez
- Para reaplicar: `docker-compose down -v && docker-compose up -d`

### Secrets para Edge Functions
Se estiver usando Supabase local, configure as secrets em um arquivo `supabase/.env.local`:

```env
EVOLUTION_API_URL=<sua-url>
EVOLUTION_API_KEY=<sua-chave>
EVOLUTION_INSTANCE_NAME=<nome-instancia>
API_USERNAME=<usuario>
API_PASSWORD=<senha>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## 🐛 Troubleshooting

### Porta já em uso
```bash
# Mude a porta no docker-compose.yml
# De: "3000:80"
# Para: "8080:80"
```

### Erro de permissão no volume
```bash
sudo chown -R $USER:$USER ./supabase
```

### Limpar tudo e começar do zero
```bash
docker-compose down -v
docker system prune -a
docker-compose up --build
```

## 📚 Mais Informações

- [Documentação Docker](https://docs.docker.com/)
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação do Projeto](README.md)
