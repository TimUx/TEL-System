# TEL-System

Ein webbasiertes Tool zur Planung und Koordination von großen Einsatzlagen wie z.B. Unwetter-Modulen.

## Inhaltsverzeichnis

- [Überblick](#überblick)
- [Features](#features)
  - [Implementierte Funktionen](#implementierte-funktionen)
  - [Geplante Funktionen](#geplante-funktionen)
- [Screenshots](#screenshots)
  - [Hauptseite - Auftragsverwaltung](#hauptseite---auftragsverwaltung)
  - [Einsatztagebuch](#einsatztagebuch)
  - [Dashboard](#dashboard)
  - [Lagekarte](#lagekarte)
  - [Historie](#historie)
- [Technologie-Stack](#technologie-stack)
- [Installation & Start](#installation--start)
  - [Voraussetzungen](#voraussetzungen)
  - [Schnellstart](#schnellstart)
  - [Mit Caddy Reverse Proxy](#mit-caddy-reverse-proxy)
  - [Erstmalige Einrichtung](#erstmalige-einrichtung)
- [Bedienung](#bedienung)
  - [Hauptfunktionen](#hauptfunktionen)
  - [Arbeitsablauf](#arbeitsablauf)
- [API-Dokumentation](#api-dokumentation)
  - [Authentifizierung](#authentifizierung)
  - [Endpunkte](#endpunkte)
- [Entwicklung](#entwicklung)
  - [Lokale Entwicklung](#lokale-entwicklung)
  - [Datenbank](#datenbank)
- [Architektur](#architektur)
- [Design-Philosophie](#design-philosophie)
- [Deployment](#deployment)
- [Lizenz](#lizenz)
- [Autor](#autor)
- [Support](#support)

## Überblick

Das TEL-System (Taktische Einsatzlagen-Koordination) ist eine webbasierte Anwendung zur effizienten Koordinierung und Verwaltung von großen Einsatzlagen, insbesondere bei Unwetterereignissen und anderen Ausnahmezuständen. Das System unterstützt Einsatzleiter und Disponenten bei der Übersicht über laufende Aufträge, eingesetzte Fahrzeuge und Ressourcen.

Die Anwendung wurde speziell für Feuerwehren und andere Hilfsorganisationen entwickelt, die mehrere Einsatzstellen gleichzeitig koordinieren müssen. Sie bietet eine zentrale Plattform zur Dokumentation aller Ereignisse und Entscheidungen während einer Einsatzlage.

## Features

### Implementierte Funktionen

- **Einsatzlagenverwaltung**: Erstellen und Verwalten von Einsatzlagen mit automatischer Nummerierung (YYYY-XXX)
- **Standortverwaltung**: Erfassung von Feuerwehrstandorten mit automatischer GPS-Koordinaten-Ermittlung
- **Fahrzeugverwaltung**: Verwaltung von Einsatzfahrzeugen mit Rufname, Typ, Besatzung und Standortzuweisung
- **Auftragsverwaltung**: Erstellen und Verwalten von Einsatzaufträgen mit Statusverfolgung (Offen, Zugewiesen, Abgeschlossen)
  - Fortlaufende Auftragsnummern (001, 002, 003) für bessere Übersichtlichkeit in Listen und auf dem Dashboard
  - Optimierte Darstellung mit vergrößerten Zahlen für Beamer-Ansichten
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

## Screenshots

### Hauptseite - Auftragsverwaltung

Die Hauptseite bietet eine übersichtliche Darstellung der aktiven Einsatzlage mit allen offenen und zugewiesenen Aufträgen. Über die Navigation können verschiedene Funktionen wie Lagekarte, Dashboard, Fahrzeuge, Standorte und Historie aufgerufen werden.

![Hauptseite mit Auftragsverwaltung](screenshots/01-hauptseite-auftraege.png)

**Funktionen:**
- Kompakter "TEL"-Header für übersichtliche Navigation
- Anzeige der aktuellen Einsatzlage mit Nummer, Titel und Beschreibung
- Liste aller Aufträge mit fortlaufender Nummer (z.B. 001, 002, 003) für bessere Übersicht
- Zugewiesene Fahrzeuge werden bei jedem Auftrag angezeigt
- Schnelle Aktionen: Auftrag abschließen, bearbeiten oder Fahrzeuge zuweisen
- Neuen Auftrag erstellen über den "Neuer Auftrag" Button

### Einsatztagebuch

Das Einsatztagebuch dokumentiert automatisch alle wichtigen Ereignisse während der Einsatzlage. Jeder Eintrag wird mit Zeitstempel und Ereignistyp versehen.

![Einsatztagebuch](screenshots/02-einsatztagebuch.png)

**Funktionen:**
- Automatische Protokollierung aller Statusänderungen
- Chronologische Darstellung mit Zeitstempeln
- Übersichtliche Anzeige der fortlaufenden Auftragsnummern (001, 002, 003, etc.)
- Manuelle Einträge für wichtige Entscheidungen und Beobachtungen
- Verknüpfung von Einträgen mit zugehörigen Aufträgen

### Dashboard

Das Dashboard ist für die Anzeige auf einem Beamer optimiert und bietet eine übersichtliche Darstellung aller wichtigen Informationen in Echtzeit.

![Dashboard in Full HD](screenshots/04-dashboard.png)

**Funktionen:**
- Übersicht über Anzahl der Aufträge, eingesetzten Fahrzeuge und Personal
- Große, gut lesbare Auftragsnummern (001, 002, 003) für optimale Sichtbarkeit auf Großbildschirmen
- Farbcodierte Darstellung der Auftragsstatus (Offen: Rot, Zugewiesen: Orange, Beendet: Grün)
- Fahrzeuge mit mehreren Aufträgen werden übersichtlich mit allen Nummern angezeigt
- Gruppierte Anzeige der Fahrzeuge nach Standorten
- Automatische Aktualisierung ohne Seitenneuladen

### Lagekarte

Die Lagekarte visualisiert alle Einsatzstellen und Fahrzeugstandorte auf einer interaktiven OpenStreetMap-Karte.

![Lagekarte](screenshots/03-lagekarte.png)

**Funktionen:**
- Darstellung aller Einsatzorte mit Markern
- Anzeige der Fahrzeugstandorte
- Unterschiedliche Symbole für verschiedene Fahrzeugtypen
- Zoom und Pan-Funktionen für detaillierte Ansicht

### Historie

Die Historie-Seite zeigt alle bisherigen Einsatzlagen mit ihren wichtigsten Informationen.

![Einsatzlagen Historie](screenshots/05-historie.png)

**Funktionen:**
- Tabellarische Übersicht aller Einsatzlagen
- Anzeige von Nummer, Titel, Erstellungs- und Abschlusszeitpunkt
- Statusanzeige (Aktiv/Geschlossen)
- Export-Funktion für Dokumentation
- Detailansicht vergangener Einsatzlagen

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

### Mit Caddy Reverse Proxy

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

## Design-Philosophie

Das Design des TEL-Systems folgt bewährten Prinzipien für Einsatzleitsoftware:

- **Übersichtlichkeit**: Klare, strukturierte Darstellung von Informationen ohne Ablenkungen
- **Schneller Zugriff**: Wichtige Funktionen sind mit wenigen Klicks erreichbar
- **Farbcodierung**: Intuitive Farben für verschiedene Status (Rot = Offen, Orange = Zugewiesen, Grün = Erledigt)
- **Responsive Design**: Optimiert für verschiedene Bildschirmgrößen von Desktop bis Tablet
- **Beamer-Modus**: Spezielles Dashboard für die Anzeige auf Großbildschirmen in Einsatzzentralen

Die Benutzeroberfläche orientiert sich an etablierten Standards der Einsatzleitsoftware und legt Wert auf intuitive Bedienbarkeit auch in stressigen Situationen.

## Deployment

Für die Produktiv-Deployment siehe die ausführliche [Deployment-Dokumentation](DEPLOYMENT.md).

Wichtige Punkte:
- Ändern Sie Standard-Passwörter und API-Keys
- Verwenden Sie HTTPS für Produktionsumgebungen
- Richten Sie regelmäßige Backups ein
- Überwachen Sie die Logs

## Lizenz

[Lizenz hier einfügen]

## Autor

TimUx

## Support

Bei Fragen oder Problemen bitte ein Issue auf GitHub erstellen.

**GitHub Repository**: https://github.com/TimUx/TEL-System
