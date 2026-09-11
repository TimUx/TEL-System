# TEL-System

Webbasierte Einsatzunterstützung für TEL-/Stabslagen mit Flask, SQLAlchemy, PostgreSQL und einem Vanilla-JS-Frontend.

## Kernfunktionen

- genau **eine** aktive Einsatzlage gleichzeitig
- Aufträge mit Statusfluss `OPEN → ASSIGNED → IN_PROGRESS → COMPLETED`
- explizite Fahrzeugstatus (`AVAILABLE`, `ALERTED`, `EN_ROUTE`, `ON_SCENE`, `UNAVAILABLE`, `OUT_OF_SERVICE`)
- automatische und manuelle Journal-Einträge mit Trennung `system` / `user`
- sichere PDF-Uploads pro Auftrag
- Lagekarte, Dashboard und Historie
- `/api/...` und `/api/v1/...` bleiben parallel verfügbar

## Architektur

- **Backend:** Flask 3.11 / SQLAlchemy
- **Datenbank:** PostgreSQL 15 (Tests zusätzlich mit SQLite)
- **Frontend:** HTML/CSS/Vanilla JavaScript
- **Karte:** Leaflet / OpenStreetMap-Fallback
- **Container:** Docker / Docker Compose
- **Tests:** pytest
- **Browser-Automation:** Playwright

## Sicherheit

- schreibende interne Endpunkte verlangen immer `X-Internal-API-Key`
- externe Endpunkte bleiben getrennt über `X-API-Key`
- Produktivstart mit Default-/fehlenden Secrets wird blockiert
- PDF-Uploads prüfen Endung, MIME-Type, Größe und tatsächlichen PDF-Inhalt
- unbekannte API-Endpunkte liefern konsistente JSON-Fehler

## Entwicklung

1. Umgebung anlegen:

```bash
cp .env.example .env
```

2. Werte in `.env` setzen, insbesondere:

- `POSTGRES_PASSWORD`
- `SECRET_KEY`
- `API_KEY`
- `INTERNAL_API_KEY`

3. Entwicklungsstack starten:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

4. URLs:

- Frontend: `http://localhost:8080`
- Backend/API: `http://localhost:5000`

5. Tests lokal:

```bash
python -m pip install -r backend/requirements.txt
pytest -q
```

## Produktion

Produktiv wird mit GHCR-Images gearbeitet:

- `ghcr.io/timux/tel-system/backend`
- `ghcr.io/timux/tel-system/frontend`

Start:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Optional mit Caddy:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d
```

## Docker Compose Dateien

- `docker-compose.yml` – lokaler Standardstack
- `docker-compose.dev.yml` – Entwicklungs-Overrides
- `docker-compose.prod.yml` – GHCR-basierter Produktionsstack
- `docker-compose.caddy.yml` – optionaler Reverse-Proxy

## Screenshots

Die versionierten Screenshots im Repository bleiben Dokumentationsmaterial.
Aktuelle CI-Screenshots werden als Workflow-Artefakte erzeugt und nicht automatisch im Repository überschrieben.

## Browser-Screenshots lokal

```bash
npm install
npx playwright install --with-deps chromium
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T backend python /app/demo_data.py
SCREENSHOT_BASE_URL=http://127.0.0.1:8080 npm run test:screenshots
```

Ergebnisse liegen unter `test-results/screenshots/`.

## Workflows

- `tests.yml` – Python-Setup, Compile-Check, pytest
- `build.yml` – Backend-/Frontend-Dockerbuild für Push und PR
- `release.yml` – Test, GHCR-Push und GitHub Release für `v*.*.*`
- `screenshots.yml` – Stack starten, Demo-Daten laden, Playwright-Screenshots als Artefakt

## API-Beispiele

### Externe API

```http
POST /api/external/assignments
X-API-Key: <external-key>
```

### Interne API

```http
POST /api/assignments/
X-Internal-API-Key: <internal-key>
Content-Type: application/json
```

## Testabdeckung

Die Tests decken u. a. ab:

- Authentifizierung und Produktions-Secret-Validierung
- nur eine aktive Einsatzlage
- Statusübergänge von Aufträgen
- doppelte Fahrzeugzuweisungen
- Journal-Systemeinträge und Chronologie
- PDF-Upload-Validierung
- Pagination und API-404-Verhalten
