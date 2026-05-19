# War of Tanks — Guia de Desplegament

## Requisit únic

**Docker Desktop** instal·lat i en execució.  
Descarrega'l a: https://www.docker.com/products/docker-desktop/

> Tots els comandos usen **`docker compose`** (Docker Desktop ja l'inclou).

---

## PER AL PROFESSOR — Arrancada del servidor

### Pas 1 · Descarrega els fitxers del servidor

Descarrega `docker-compose.server.yml` des del repositori:  
https://github.com/JosepTomasComellas/WarOfTanks

O amb una sola comanda:

```bash
curl -O https://raw.githubusercontent.com/JosepTomasComellas/WarOfTanks/master/docker-compose.server.yml
```

### Pas 2 · Arranca el servidor

```bash
docker compose -f docker-compose.server.yml up -d
```

La primera vegada descarrega la imatge automàticament (~50 MB). Triga ~1 minut.

Comprova que funciona:

```bash
docker compose -f docker-compose.server.yml logs
```

Hauries de veure:
```
[Server] UDP listening on port 8888
[Proxy]  HTTP+WS on port 8080
```

### Pas 3 · Obtén la teva IP i comunica-la als alumnes

**Windows:**
```
ipconfig
```
Busca **"Adaptador Ethernet"** o **"WiFi"** → **"Adreça IPv4"**

**macOS / Linux:**
```bash
ip route get 1 | awk '{print $7}'
```

Escriu la IP a la pissarra:
```
┌─────────────────────────────────┐
│  IP del servidor: 192.168.1.50  │
└─────────────────────────────────┘
```

### Pas 4 · Obre el panell d'administració

Amb el servidor arrencat, obre al teu navegador:

```
http://localhost:8080/admin.html
```

Des d'aquí pots veure els jugadors connectats, forçar una nova ronda i expulsar jugadors.

### Aturar el servidor

```bash
docker compose -f docker-compose.server.yml down
```

---

## PER ALS ALUMNES — Connexió al joc

### Pas 1 · Descarrega els fitxers

Descarrega **els dos fitxers** i posa'ls a la mateixa carpeta (per exemple, a l'Escriptori):

| Fitxer | Contingut |
|--------|-----------|
| [`docker-compose.yml`](https://raw.githubusercontent.com/JosepTomasComellas/WarOfTanks/master/docker-compose.yml) | Configuració del contenidor |
| [`.env.example`](https://raw.githubusercontent.com/JosepTomasComellas/WarOfTanks/master/.env.example) | Plantilla de configuració |

### Pas 2 · Crea el fitxer de configuració

Copia `.env.example` i anomena la còpia exactament **`.env`** (sense extensió addicional).

Obre `.env` amb el bloc de notes i canvia la IP pel valor que ha indicat el professor:

```env
SERVER_IP=192.168.1.50
```

> **Atenció:** El fitxer s'ha d'anomenar `.env`, no `.env.txt`.  
> Al Windows, activa "Mostra extensions de fitxer" a l'Explorador per verificar-ho.

### Pas 3 · Arranca el client

Obre una terminal a la carpeta on tens els fitxers i executa:

```bash
docker compose up -d
```

La primera vegada descarrega la imatge (~50 MB). Espera que aparegui:
```
Container wot-client  Started
```

### Pas 4 · Obre el joc

Obre el navegador i ves a:

```
http://localhost:8080
```

Escriu el teu nom i prem **PLAYER START**.

### Controls

| Tecla | Acció |
|-------|-------|
| `W` o `↑` | Avançar |
| `S` o `↓` | Retrocedir |
| `A` o `←` | Girar a l'esquerra |
| `D` o `→` | Girar a la dreta |
| `Espai` | Disparar |

### Aturar el client

```bash
docker compose down
```

---

## Panell d'administració (professor)

Accessible des del navegador del servidor:

```
http://localhost:8080/admin.html
```

| Funció | Descripció |
|--------|------------|
| Stats | Jugadors, tanks actius, bales en vol, tick |
| Nova Ronda | Reinicia el mapa i les vides (manté puntuació) |
| Reset Puntuació | Posa tots els marcadors a 0 |
| Kick | Expulsa un jugador de la partida |

---

## Resolució de problemes

| Problema | Causa probable | Solució |
|----------|---------------|---------|
| `docker compose` no es reconeix | Docker Desktop no està obert | Obre Docker Desktop i espera que arrenqui |
| La pàgina no carrega | El contenidor no ha arrencat | `docker compose logs` per veure l'error |
| No es connecta al servidor | IP incorrecta al `.env` | Verifica la IP amb el professor |
| No es connecta al servidor | Firewall del servidor | Obre el port **UDP 8888** al firewall del PC servidor |
| El tank no respon | El navegador no té el focus | Fes clic al canvas del joc |
| Ping molt alt (>200ms) | WiFi saturat | Connecta per cable Ethernet si és possible |
| No veig el fitxer `.env` | Windows oculta extensions | Activa "Mostra extensions de fitxer" a l'Explorador |

### Veure logs en temps real

```bash
# Servidor
docker compose -f docker-compose.server.yml logs -f

# Client
docker compose logs -f
```

---

## Guió ràpid per a la competició

```
┌──────────────────────────────────────────────────────┐
│            CHECKLIST  ·  War of Tanks                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  PROFESSOR (fer-ho primer):                          │
│                                                      │
│  □ Obre Docker Desktop                               │
│  □ Executa:                                          │
│      docker compose -f docker-compose.server.yml     │
│                      up -d                           │
│  □ Obtén la IP amb: ipconfig                         │
│  □ Escriu la IP a la pissarra                        │
│  □ Obre: http://localhost:8080/admin.html            │
│                                                      │
│  ALUMNES (un cop saben la IP):                       │
│                                                      │
│  □ Editen .env → SERVER_IP=<IP de la pissarra>       │
│  □ Executen: docker compose up -d                    │
│  □ Obren: http://localhost:8080                      │
│  □ Escriuen el seu nom → PLAYER START                │
│                                                      │
│  INICIAR RONDA:                                      │
│                                                      │
│  □ Espera que tothom estigui connectat               │
│     (ho veus al panell admin)                        │
│  □ Prem "NOVA RONDA" al panell admin                 │
│  □ Last tank standing guanya (+500 pts)              │
│                                                      │
│  ACABAR:                                             │
│                                                      │
│  □ docker compose -f docker-compose.server.yml down  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Arquitectura (per als curiosos)

```
  NAVEGADOR (localhost:8080)
       │
       │  WebSocket
       ▼
  DOCKER CLIENT (proxy Node.js)
       │
       │  UDP · port 8888 · xarxa d'aula
       ▼
  DOCKER SERVIDOR (game loop Node.js)
       │ autoritatiu: física, col·lisions, puntuació
```

El Docker de cada alumne fa de **pont**: tradueix WebSocket ↔ UDP.  
El navegador no parla mai directament amb el servidor.
