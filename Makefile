.PHONY: evaluate down logs

# RNF10 — Despliegue reproducible con un único comando.
evaluate:
	bash evaluate.sh

down:
	docker compose down -v --remove-orphans

logs:
	docker compose logs -f --tail=100
