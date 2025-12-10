# TEL-System

Ein webbasiertes Tool zur Planung und Koordination von großen Einsatzlagen wie z.B. Unwetter-Modulen.

## Features

### Implementierte Funktionen

- **Einsatzlagenverwaltung**: Erstellen und Verwalten von Einsatzlagen mit automatischer Nummerierung (YYYY-XXX)
- **Standortverwaltung**: Erfassung von Feuerwehrstandorten mit automatischer GPS-Koordinaten-Ermittlung
- **Fahrzeugverwaltung**: Verwaltung von Einsatzfahrzeugen mit Rufname, Typ, Besatzung und Standortzuweisung
- **Auftragsverwaltung**: Erstellen und Verwalten von Einsatzaufträgen mit Statusverfolgung (Offen, Zugewiesen, Abgeschlossen)
- **Lagekarte**: OpenStreetMap-basierte Karte zur Visualisierung von Einsatzstellen und Fahrzeugen
- **Dashboard**: Übersichtliche Beamer-optimierte Ansicht mit Aufträgen und Fahrzeugen
- **Einsatztagebuch**: Chronologische Erfassung aller Ereignisse und Entscheidungen
- **Historie**: Archivierung und Anzeige aller abgeschlossenen Einsatzlagen
- **Fahrzeugzuweisung**: Zuweisung von Fahrzeugen zu Aufträgen mit Warteschlangen-Funktion
- **REST API**: Externe API-Schnittstelle für Integration mit anderen Systemen

### Geplante Funktionen

- IMAP Email-Integration für automatischen Auftragsempfang
- PDF-Parsing für automatische Datenextraktion aus Email-Anhängen
- PDF-Export der Einsatztagebücher
- Read-Only Ansicht für geschlossene Einsatzlagen
- Erweiterte Kartenfunktionen (Drag & Drop Positionierung)

## Technologie-Stack

- **Backend**: Flask (Python 3.11)
- **Datenbank**: PostgreSQL 15
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Karten**: Leaflet.js mit OpenStreetMap
- **Container**: Docker & Docker Compose
- **Reverse Proxy**: Optional Caddy (für HTTPS)

## Installation & Start

### Voraussetzungen

- Docker
- Docker Compose

### Schnellstart

1. Repository klonen:
```bash
git clone https://github.com/TimUx/TEL-System.git
cd TEL-System
```

2. System starten:
```bash
docker compose up -d
```

3. Anwendung öffnen:
- Anwendung: http://localhost:5000

### Mit optionalem Caddy Reverse Proxy (z.B. für HTTPS)

Wenn Sie HTTPS oder zusätzliche Proxy-Features benötigen:

```bash
# Caddy-Konfiguration anpassen (optional)
nano Caddyfile

# System mit Caddy starten
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```

Dann ist die Anwendung unter http://localhost erreichbar (Port 80).

### Erstmalige Einrichtung

1. Neue Einsatzlage erstellen über den Button "Neue Einsatzlage"
2. Standorte anlegen unter dem Tab "Standorte"
3. Fahrzeuge anlegen unter dem Tab "Fahrzeuge"
4. Aufträge erstellen und Fahrzeuge zuweisen

## Bedienung

### Hauptfunktionen

- **Neue Einsatzlage**: Erstellt eine neue Einsatzlage mit automatischer Nummerierung
- **Lagekarte öffnen**: Öffnet die Lagekarte in einem separaten Fenster
- **Dashboard öffnen**: Öffnet das Beamer-Dashboard in einem separaten Fenster
- **Historie**: Zeigt alle bisherigen Einsatzlagen an
- **Lage schließen**: Schließt die aktuelle Einsatzlage (keine Änderungen mehr möglich)

### Arbeitsablauf

1. Einsatzlage erstellen
2. Aufträge erfassen mit Einsatzort und Details
3. Fahrzeuge den Aufträgen zuweisen
4. Status auf der Lagekarte und im Dashboard verfolgen
5. Einsatztagebuch kontinuierlich pflegen
6. Aufträge als abgeschlossen markieren
7. Einsatzlage schließen

## API-Dokumentation

### Authentifizierung

Externe API-Aufrufe benötigen einen API-Key im Header:
```
X-API-Key: your-api-key
```

### Endpunkte

- `POST /api/external/assignments` - Neuen Auftrag erstellen
- `GET /api/external/health` - Health Check

Weitere API-Endpunkte siehe Backend-Code in `/backend/routes/`

## Entwicklung

### Lokale Entwicklung

Backend:
```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql://tel_user:tel_password@localhost:5432/tel_system
flask run
```

Frontend:
```bash
cd frontend
python -m http.server 8080
```

### Datenbank

Die Datenbank wird automatisch beim ersten Start initialisiert. 
Persistente Daten werden im Docker Volume `postgres_data` gespeichert.

## Architektur

```
TEL-System/
├── backend/              # Flask Backend
│   ├── routes/          # API Routen
│   ├── models.py        # Datenbank-Modelle
│   └── app.py           # Hauptanwendung
├── frontend/            # Frontend
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript
│   └── *.html          # HTML-Seiten
└── docker-compose.yml  # Container-Konfiguration
```

## Design

Das Design orientiert sich an:
- [alarm-messenger](https://github.com/TimUx/alarm-messenger) - Für das Admin-Interface
- [fw-lagekarte](https://github.com/TimUx/fw-lagekarte) - Für Kartendarstellung und Fahrzeugsymbole
- [Fireboard Modul Ausnahmezustand](https://fireboard.net/produkte/module/modul-ausnahmezustand/) - Für Funktionalität

## Lizenz

[Lizenz hier einfügen]

## Autor

TimUx

## Support

Bei Fragen oder Problemen bitte ein Issue auf GitHub erstellen.
