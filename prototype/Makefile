# make data  -> parse market files, generate synthetic population, fit clusters, write artifacts/
# make dev   -> start the API + built UI on http://localhost:8000
# make test  -> run all unit and persona tests
# make ui    -> rebuild the React UI (needs Node 18+); a built copy is already in frontend/dist
PY ?= python
.PHONY: data dev test ui
data:
	cd backend && $(PY) -m yourbroker.build
dev:
	cd backend && $(PY) -m uvicorn yourbroker.api:app --port 8000
test:
	cd backend && $(PY) -m pytest -q
ui:
	cd frontend && npm install && npm run build
