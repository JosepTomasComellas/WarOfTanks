# War of Tanks — Manual de Desplegament

## Índex

1. [Arquitectura del sistema](#1-arquitectura-del-sistema)
2. [Servidor — Ubuntu Server](#2-servidor--ubuntu-server)
3. [Clients — Windows amb Docker Desktop](#3-clients--windows-amb-docker-desktop)
4. [Panell d'administració](#4-panell-dadministració)
5. [Actualitzar a una versió nova](#5-actualitzar-a-una-versió-nova)
6. [Resolució de problemes](#6-resolució-de-problemes)

---

## 1. Arquitectura del sistema

```
   PC PROFESSOR (Ubuntu Server)
   ┌──────────────────────────────┐
   │  Docker → War of Tanks       │
   │  · Game loop (UDP :8888)     │
   │  · Interfície web (:8888)    │
   │  · Panell admin (:8888)      │
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
         │ localhost:8888        │ localhost:8888
    ┌────▼────┐             ┌────▼────┐
    │Navegador│             │Navegador│
    └─────────┘             └─────────┘
```

Cada alumne obre `http://localhost:8888` al seu navegador.  
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
sudo ufw allow 8888/tcp   # interfície web i panell admin
sudo ufw reload
sudo ufw status
```

Ha d'aparèixer:
```
8888/udp     ALLOW
8888/tcp     ALLOW
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
[Proxy]  HTTP+WS on port 8888  →  UDP localhost:8888
[Proxy]  Admin panel at http://localhost:8888/admin.html
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
http://192.168.1.50:8888
```

Ha d'aparèixer la pantalla de login de War of Tanks.

### 2.9 Configurar la densitat de parets

Per defecte el mapa té poca densitat de parets (camp obert). Pots ajustar-ho editant `docker-compose.server.yml`:

```yaml
environment:
  - WALL_DENSITY=20    # 0=camp buit · 20=poc dens · 50=moderat · 100=molt dens
```

Després de canviar el valor, reinicia el servidor:

```bash
sudo docker compose -f docker-compose.server.yml up --build -d
```

### 2.10 Comandos de gestió del servidor

```bash
# Veure logs en temps real
sudo docker compose -f docker-compose.server.yml logs -f

# Aturar el servidor
sudo docker compose -f docker-compose.server.yml down

# Reiniciar el servidor
sudo docker compose -f docker-compose.server.yml restart
```

---

### 2.11 Activar HTTPS (opcional)

Si tens certificats SSL (per exemple de Let's Encrypt o corporatius), pots servir la interfície web per HTTPS. El port de joc UDP continua sent el 8888.

#### Pas 1 · Prepara els certificats

Els fitxers han d'estar accessibles al servidor. Per exemple:

```
/etc/ssl/wot/cert.pem       ← certificat (o fullchain.pem)
/etc/ssl/wot/key.pem        ← clau privada (o privkey.pem)
```

Si fas servir Let's Encrypt, els trobaràs a:
```
/etc/letsencrypt/live/<domini>/fullchain.pem
/etc/letsencrypt/live/<domini>/privkey.pem
```

#### Pas 2 · Crea un fitxer `.env` a la carpeta del projecte

```bash
cat > /opt/WarOfTanks/.env << 'EOF'
CERTS_PATH=/etc/ssl/wot
EOF
```

(Substitueix `/etc/ssl/wot` pel directori real dels teus certificats.)

#### Pas 3 · Edita `docker-compose.server.yml`

Descomenta les línies marcades amb `[HTTPS]`:

```yaml
environment:
  - ROLE=server
  - UDP_PORT=8888
  - HTTP_PORT=8888
  - HTTPS_ENABLED=true          # ← descomenta
  - SSL_CERT=/certs/cert.pem    # ← descomenta (ajusta el nom si cal)
  - SSL_KEY=/certs/key.pem      # ← descomenta (ajusta el nom si cal)

volumes:
  - ${CERTS_PATH}:/certs:ro     # ← descomenta
```

> Si els teus fitxers no es diuen `cert.pem` i `key.pem`, canvia els noms a les variables `SSL_CERT` i `SSL_KEY`. Per exemple, per Let's Encrypt:
> ```yaml
> - SSL_CERT=/certs/fullchain.pem
> - SSL_KEY=/certs/privkey.pem
> ```

#### Pas 4 · Reinicia el servidor

```bash
cd /opt/WarOfTanks
sudo docker compose -f docker-compose.server.yml up --build -d
sudo docker compose -f docker-compose.server.yml logs
```

Has de veure:
```
[Proxy] HTTPS activat (cert: /certs/cert.pem)
[Proxy] HTTPS+WSS on port 8888  →  UDP localhost:8888
[Proxy] Open browser at https://localhost:8888
```

#### Pas 5 · Accedir

La interfície web i el panell d'administrador ara s'accedeixen per HTTPS:

```
https://<IP_SERVIDOR>:8888
https://<IP_SERVIDOR>:8888/admin.html
```

El navegador dels alumnes usarà automàticament `wss://` per al WebSocket.

> **Nota sobre el firewall:** No cal canviar res, el port 8888/tcp ja estava obert.

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
2. Ves a: `http://localhost:8888`
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

### 3.8 Sortir del joc

Per sortir d'una partida en curs, fes clic al botó **✕ SORTIR** que apareix a la cantonada superior esquerra de la pantalla de joc. El joc et retornarà a la pantalla d'inici sense tancar el Docker.

Si el professor tanca la partida des del panell d'administració, tots els clients tornaran automàticament a la pantalla d'inici.

### 3.9 Aturar el client

Quan acabis de jugar:

```powershell
docker compose down
```

---

## 4. Panell d'administració

Accessible **des del servidor** (o des de qualsevol navegador de la xarxa):

```
http://<IP_SERVIDOR>:8888/admin.html
```

Si ets al propi servidor:

```
http://localhost:8888/admin.html
```

### Funcions disponibles

| Funció | Descripció |
|--------|------------|
| **Stats en temps real** | Jugadors connectats, tanks actius, bales en vol, tick actual |
| **Camp de batalla en directe** | Canvas 480×360 que mostra el mapa, els tancs i les bales actualitzat cada 200 ms |
| **Classificació** | Rànquing amb punts, vides i estat de cada jugador, actualitzat cada 200 ms |
| **Nova Ronda** | Genera un mapa nou amb parets noves, restaura vides (manté puntuació) |
| **Reset Puntuació** | Posa tots els marcadors a zero |
| **Tancar Partida** | Desconnecta tots els jugadors i retorna-los a la pantalla d'inici |
| **Kick** | Expulsa un jugador concret de la partida |

### Llegenda del camp de batalla

| Element | Representació |
|---------|---------------|
| Terra | Quadre fosc |
| Paret | Quadre marró |
| Tank viu | Quadre de color del jugador amb línia de direcció |
| Tank mort | Quadre de color semitransparent |
| Bala | Punt groc |

### Sistema de puntuació

| Acció | Punts |
|-------|-------|
| Eliminar un tank enemic | +100 |
| Guanyar la ronda (last tank standing) | +500 |

### Mecàniques del joc

- **Parets destructibles:** les bales destrueixen les parets interiors quan hi impacten. La destrucció es sincronitza en temps real a tots els clients. Les parets del perímetre exterior són indestructibles.
- **Nova ronda:** quan queda un sol jugador viu (o el professor prem "Nova Ronda"), es genera un mapa completament nou. Tots els clients reben el mapa actualitzat automàticament.

---

## 5. Actualitzar a una versió nova

### Servidor (Ubuntu Server)

```bash
cd /opt/WarOfTanks
sudo git pull
sudo docker compose -f docker-compose.server.yml up --build -d
```

Comprova que ha arrencat correctament:

```bash
sudo docker compose -f docker-compose.server.yml logs
```

> Si havies editat `docker-compose.server.yml` (per exemple per a HTTPS o WALL_DENSITY), els teus canvis es mantenen perquè `git pull` no sobreescriu fitxers modificats localment. Si hi ha conflicte, Git t'avisarà.

### Clients (Windows)

**Si van instal·lar amb Git:**

Obre una terminal a la carpeta del joc i executa:

```powershell
git pull
docker compose up --build -d
```

**Si van instal·lar amb ZIP:**

1. Ves a https://github.com/JosepTomasComellas/WarOfTanks
2. Descarrega el ZIP nou (**Code → Download ZIP**)
3. Extreu el ZIP a la mateixa carpeta, substituint els fitxers (conserva el `.env`)
4. Obre una terminal i executa:

```powershell
docker compose up --build -d
```

> El fitxer `.env` (amb la IP del servidor) no es veu afectat per l'actualització si fas servir Git. Amb el ZIP, comprova que el `.env` segueix tenint la IP correcta.

---

## 6. Resolució de problemes

### El servidor no arrenca

```bash
# Comprova que Docker funciona
sudo docker ps

# Comprova que els ports no estan ocupats
sudo ss -tulpn | grep 8888

# Veure els logs d'error
sudo docker compose -f docker-compose.server.yml logs
```

### Els alumnes no es connecten al servidor

```bash
# Des del servidor, verifica que els ports escolten
sudo ss -tulpn | grep 8888
sudo ss -ulpn | grep 8888

# Des d'un PC client (Windows), prova la connectivitat HTTP:
# Obre el navegador i ves a http://<IP_SERVIDOR>:8888
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
