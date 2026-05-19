# War of Tanks — Manual de Desplegament

## Índex

1. [Arquitectura del sistema](#1-arquitectura-del-sistema)
2. [Servidor — Ubuntu Server](#2-servidor--ubuntu-server)
3. [Clients — Windows amb Docker Desktop](#3-clients--windows-amb-docker-desktop)
4. [Panell d'administració](#4-panell-dadministració)
5. [Resolució de problemes](#5-resolució-de-problemes)

---

## 1. Arquitectura del sistema

```
   PC PROFESSOR (Ubuntu Server)
   ┌──────────────────────────────┐
   │  Docker → War of Tanks       │
   │  · Game loop (UDP :8888)     │
   │  · Interfície web (:8080)    │
   │  · Panell admin (:8080)      │
   └──────────────┬───────────────┘
                  │ xarxa d'aula (LAN / WiFi)
       ┌──────────┴──────────┐
       ▼                     ▼
   PC ALUMNE 1           PC ALUMNE 2  ...fins a 120
   ┌────────────┐         ┌────────────┐
   │  Docker    │         │  Docker    │
   │  proxy     │         │  proxy     │
   │  WS ↔ UDP │         │  WS ↔ UDP │
   └─────┬──────┘         └─────┬──────┘
         │ localhost:8080        │ localhost:8080
    ┌────▼────┐             ┌────▼────┐
    │Navegador│             │Navegador│
    └─────────┘             └─────────┘
```

Cada alumne obre `http://localhost:8080` al seu navegador.  
El Docker local fa de pont entre el navegador (WebSocket) i el servidor (UDP).

---

## 2. Servidor — Ubuntu Server

### 2.1 Requisits previs

- Ubuntu Server 22.04 o superior
- Connexió a la mateixa xarxa que els alumnes
- Accés root o usuari amb `sudo`

### 2.2 Instal·lar Docker

Executa el script oficial de Docker (instal·la Docker Engine + Compose plugin):

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Verifica que funciona:

```bash
docker --version
docker compose version
```

Ha d'aparèixer alguna cosa com:
```
Docker version 26.x.x
Docker Compose version v2.x.x
```

### 2.3 Instal·lar Git

```bash
sudo apt update && sudo apt install -y git
```

### 2.4 Clonar el repositori

```bash
cd /opt
sudo git clone https://github.com/JosepTomasComellas/WarOfTanks.git
cd WarOfTanks
```

### 2.5 Configurar el firewall

Obre els ports necessaris:

```bash
sudo ufw allow 8888/udp   # protocol de joc
sudo ufw allow 8080/tcp   # interfície web i panell admin
sudo ufw reload
sudo ufw status
```

Ha d'aparèixer:
```
8888/udp     ALLOW
8080/tcp     ALLOW
```

> Si el sistema no té `ufw`, comprova amb `sudo iptables -L` i afegeix les regles corresponents.

### 2.6 Arrencar el servidor

```bash
cd /opt/WarOfTanks
sudo docker compose -f docker-compose.server.yml up --build -d
```

La primera vegada construeix la imatge (~2-3 minuts). Les vegades següents és instantani.

Verifica que funciona:

```bash
sudo docker compose -f docker-compose.server.yml logs
```

Has de veure les tres línies de confirmació:
```
[Server] UDP listening on port 8888
[Proxy]  HTTP+WS on port 8080  →  UDP localhost:8888
[Proxy]  Admin panel at http://localhost:8080/admin.html
```

### 2.7 Obtenir la IP del servidor

```bash
hostname -I | awk '{print $1}'
```

o bé:

```bash
ip route get 1 | awk '{print $7}'
```

**Apunta aquesta IP i escriu-la a la pissarra.** Els alumnes la necessitaran.

Exemple: `192.168.1.50`

### 2.8 Verificar l'accés des de la xarxa

Des d'un altre ordinador de la mateixa xarxa, obre el navegador a:

```
http://192.168.1.50:8080
```

Ha d'aparèixer la pantalla de login de War of Tanks.

### 2.9 Comandos de gestió del servidor

```bash
# Veure logs en temps real
sudo docker compose -f docker-compose.server.yml logs -f

# Aturar el servidor
sudo docker compose -f docker-compose.server.yml down

# Reiniciar el servidor
sudo docker compose -f docker-compose.server.yml restart

# Actualitzar a la darrera versió
cd /opt/WarOfTanks
sudo git pull
sudo docker compose -f docker-compose.server.yml up --build -d
```

---

## 3. Clients — Windows amb Docker Desktop

### 3.1 Requisits previs

- Windows 10 (versió 21H2 o superior) o Windows 11
- Docker Desktop instal·lat
- Connexió a la mateixa xarxa que el servidor

### 3.2 Instal·lar Docker Desktop

1. Ves a: https://www.docker.com/products/docker-desktop/
2. Descarrega **Docker Desktop for Windows**
3. Executa l'instal·lador i segueix els passos (accepta tots els valors per defecte)
4. Reinicia l'ordinador si ho demana
5. Obre **Docker Desktop** des del menú inici
6. Espera que aparegui la icona de Docker a la barra de tasques amb l'indicador verd ✅

> Docker Desktop requereix **WSL 2** (Windows Subsystem for Linux). L'instal·lador ho configura automàticament, però potser demana activar la virtualització a la BIOS.

### 3.3 Descarregar els fitxers del joc

**Opció A — amb Git** (si el tens instal·lat):

Obre una terminal (PowerShell o CMD) i executa:

```powershell
git clone https://github.com/JosepTomasComellas/WarOfTanks.git
cd WarOfTanks
```

**Opció B — sense Git** (descarrega manual):

1. Ves a https://github.com/JosepTomasComellas/WarOfTanks
2. Clica el botó verd **Code** → **Download ZIP**
3. Extreu el ZIP a una carpeta (per exemple `C:\WarOfTanks`)
4. Obre una terminal dins d'aquesta carpeta

### 3.4 Crear el fitxer de configuració

A la carpeta del joc, copia el fitxer d'exemple:

```powershell
copy .env.example .env
```

Obre `.env` amb el Bloc de notes:

```powershell
notepad .env
```

Canvia la IP per la que ha indicat el professor:

```env
SERVER_IP=192.168.1.50
```

Desa el fitxer i tanca el Bloc de notes.

> **Important:** El fitxer s'ha d'anomenar `.env` (sense cap extensió addicional).  
> Si l'Explorador de Windows no mostra les extensions, activa-les a:  
> **Vista → Mostra → Extensions de nom de fitxer**

### 3.5 Arrencar el client

A la terminal, executa:

```powershell
docker compose up --build -d
```

La primera vegada construeix la imatge (~2-3 minuts). Quan acabi veuràs:

```
✔ Container wot-client  Started
```

### 3.6 Obrir el joc

1. Obre el navegador (Chrome, Firefox o Edge)
2. Ves a: `http://localhost:8080`
3. Escriu el teu nom
4. Prem **PLAYER START**

### 3.7 Controls del joc

| Tecla | Acció |
|-------|-------|
| `W` o `↑` | Avançar |
| `S` o `↓` | Retrocedir |
| `A` o `←` | Girar a l'esquerra |
| `D` o `→` | Girar a la dreta |
| `Espai` | Disparar |

### 3.8 Aturar el client

Quan acabis de jugar:

```powershell
docker compose down
```

---

## 4. Panell d'administració

Accessible **des del servidor** (o des de qualsevol navegador de la xarxa):

```
http://<IP_SERVIDOR>:8080/admin.html
```

Si ets al propi servidor:

```
http://localhost:8080/admin.html
```

### Funcions disponibles

| Funció | Descripció |
|--------|------------|
| **Stats en temps real** | Jugadors connectats, tanks actius, bales en vol |
| **Classificació** | Rànquing actualitzat cada 2 segons |
| **Nova Ronda** | Genera un mapa nou, restaura vides (manté puntuació) |
| **Reset Puntuació** | Posa tots els marcadors a zero |
| **Kick** | Expulsa un jugador de la partida |

### Sistema de puntuació

| Acció | Punts |
|-------|-------|
| Eliminar un tank enemic | +100 |
| Guanyar la ronda (last tank standing) | +500 |

---

## 5. Resolució de problemes

### El servidor no arrenca

```bash
# Comprova que Docker funciona
sudo docker ps

# Comprova que els ports no estan ocupats
sudo ss -tulpn | grep -E '8080|8888'

# Veure els logs d'error
sudo docker compose -f docker-compose.server.yml logs
```

### Els alumnes no es connecten al servidor

```bash
# Des del servidor, verifica que els ports escolten
sudo ss -tulpn | grep 8080
sudo ss -ulpn | grep 8888

# Des d'un PC client (Windows), prova la connectivitat HTTP:
# Obre el navegador i ves a http://<IP_SERVIDOR>:8080
# Si no carrega → problema de xarxa o firewall

# Comprova el firewall al servidor
sudo ufw status
```

### Docker Desktop no arrenca a Windows

- Verifica que la **virtualització** està activada a la BIOS/UEFI
- Assegura't que **WSL 2** està instal·lat: obre PowerShell com a administrador i executa `wsl --update`
- Reinicia Docker Desktop

### El fitxer `.env` no es reconeix

- Verifica que el fitxer es diu exactament `.env` (no `.env.txt`)
- Executa `dir /a` a CMD per veure tots els fitxers incloent els ocults
- El fitxer ha d'estar a la mateixa carpeta que `docker-compose.yml`

### El tank no respon als controls

- Fes clic directament sobre el canvas del joc per assegurar-te que té el focus del teclat
- Comprova que no tens una extensió del navegador que captura les tecles de fletxa

### Logs útils

```bash
# Servidor (Ubuntu)
sudo docker compose -f docker-compose.server.yml logs -f

# Client (Windows PowerShell)
docker compose logs -f
```
