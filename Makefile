COMPOSE = docker compose -f infra/docker-compose.yml

.PHONY: up down logs api-test lint

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail 100

api-test:
	cd apps/api && uv run pytest -m "not integration"

lint:
	cd apps/api && uv run ruff check && uv run ruff format --check && uv run mypy src
