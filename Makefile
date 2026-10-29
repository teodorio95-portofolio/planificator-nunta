.DEFAULT_GOAL := help
SHELL := /bin/bash

COMPOSE := docker compose
COMPOSE_HTTPS := docker compose -f compose.yaml -f compose.https.yaml
IMAGE ?= ghcr.io/teodorio95-portofolio/planificator-nunta
BACKUP_DIR := data/backups
STAMP = $(shell date +%Y%m%d-%H%M%S)

.PHONY: help install dev demo test check build start env up up-https down logs backup docker-build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (npm ci)
	npm ci

dev: ## Dev server on http://localhost:5173 (open as admin unless a password or Google is set)
	npx vite dev

demo: ## Dev server on a throwaway database filled with a made-up wedding
	DATABASE_PATH=data/demo.db DEMO_DATA=true npx vite dev

test: ## Unit tests
	npx vitest run

check: ## Type-check Svelte + TypeScript
	npm run check

build: ## Production build into build/
	npm run build

start: build ## Run the production build on http://localhost:3000 (reads .env)
	set -a; [ -f .env ] && source .env; set +a; node build

env: ## Create .env from .env.example (never overwrites)
	@[ -f .env ] && echo ".env exists, left as is" || (cp .env.example .env && echo "created .env: set ADMIN_PASSWORD")

up: ## Run the container on http://localhost:3000 (data in the nunta-data volume)
	$(COMPOSE) up -d --build

up-https: ## Run behind Caddy with automatic HTTPS for DOMAIN from .env (app port on 127.0.0.1 only)
	BIND_ADDRESS=127.0.0.1 $(COMPOSE_HTTPS) up -d --build

down: ## Stop the containers (keeps the data volume)
	$(COMPOSE) down

logs: ## Follow the app's logs
	$(COMPOSE) logs -f app

backup: ## Copy the database, cover photo and music out of the running container into data/backups/
	mkdir -p $(BACKUP_DIR)/$(STAMP)
	$(COMPOSE) exec app node db-snapshot.mjs /tmp/nunta.db
	$(COMPOSE) cp app:/tmp/nunta.db $(BACKUP_DIR)/$(STAMP)/nunta.db
	-$(COMPOSE) cp app:/data/coperta.img $(BACKUP_DIR)/$(STAMP)/coperta.img 2>/dev/null
	-$(COMPOSE) cp app:/data/muzica.audio $(BACKUP_DIR)/$(STAMP)/muzica.audio 2>/dev/null
	@echo "backup in $(BACKUP_DIR)/$(STAMP)"

docker-build: ## Build the image locally as $(IMAGE):local
	docker build -t $(IMAGE):local .

clean: ## Remove build output (keeps data/)
	rm -r build .svelte-kit 2>/dev/null || true
