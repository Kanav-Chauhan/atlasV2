# Atlas v2

Company knowledge assistant: staff ask questions and get answers from their company's documents, with citations, filtered by role and department. Full plan: [PLAN.md](PLAN.md).

## Run

```sh
cp infra/.env.example infra/.env   # fill in passwords
docker compose -f infra/docker-compose.yml up -d
```

- Web: http://127.0.0.1:3011
- API: http://127.0.0.1:8111/health (ready check: `/health/ready`)

## Develop

```sh
cd apps/api && uv sync
make lint
make api-test
```
