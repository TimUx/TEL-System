# Deployment TEL-System

## 1. Voraussetzungen

- Docker Engine 20.10+
- Docker Compose 2+
- Zugriff auf GHCR für `ghcr.io/timux/tel-system/*`

## 2. Umgebungsdatei

`.env` aus `.env.example` erzeugen:

```bash
cp .env.example .env
```

Pflichtwerte:

```env
POSTGRES_DB=tel_system
POSTGRES_USER=tel_user
POSTGRES_PASSWORD=<starkes-passwort>
DATABASE_URL=postgresql://tel_user:<starkes-passwort>@db:5432/tel_system
SECRET_KEY=<starker-flask-secret>
API_KEY=<starker-externer-api-key>
INTERNAL_API_KEY=<starker-interner-api-key>
CORS_ORIGINS=https://tel.example.org
MAX_CONTENT_LENGTH=16777216
MAX_PDF_UPLOAD_SIZE=8388608
GEOCODER_TIMEOUT_SECONDS=2.0
```

## 3. Produktionsstart mit GHCR

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Optional mit Caddy:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d
```

## 4. Healthchecks

- Backend: `GET /api/external/health`
- Frontend: `GET /`
- PostgreSQL: `pg_isready`

Prüfung:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost:5000/api/external/health
```

## 5. Entwicklung vs. Produktion

### Entwicklung

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

- lokale Bind-Mounts für `backend/` und `frontend/`
- Backend auf `:5000`
- Frontend auf `:8080`

### Produktion

```bash
docker compose -f docker-compose.prod.yml up -d
```

- keine lokalen Builds erforderlich
- Images werden aus GHCR gezogen
- Uploads und Datenbank bleiben über Volumes persistent

## 6. Releases / Images

Release-Tags `v*.*.*` veröffentlichen automatisch:

- `ghcr.io/timux/tel-system/backend:latest`
- `ghcr.io/timux/tel-system/backend:<tag>`
- `ghcr.io/timux/tel-system/backend:<sha>`
- `ghcr.io/timux/tel-system/frontend:latest`
- `ghcr.io/timux/tel-system/frontend:<tag>`
- `ghcr.io/timux/tel-system/frontend:<sha>`

## 7. Screenshots / visueller Smoke-Test

Workflow `screenshots.yml`:

1. startet den Dev-Stack
2. lädt reproduzierbare Demo-Daten
3. erzeugt Playwright-Screenshots
4. speichert sie als Actions-Artefakt

Die vorhandenen Screenshots im Repository dienen weiter als Dokumentation; die CI überschreibt sie nicht automatisch.

## 8. Backup

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

## 9. Wichtige Betriebsregeln

- ohne gesetzten `INTERNAL_API_KEY` sind schreibende interne Endpunkte nicht nutzbar
- Produktivstart mit Default-Secrets schlägt absichtlich fehl
- PDF-Uploads liegen außerhalb des statischen Frontends in `/app/uploads`
- für bestehende Alt-Datenbanken sollten Änderungen zuerst in einer Staging-Umgebung geprüft werden
