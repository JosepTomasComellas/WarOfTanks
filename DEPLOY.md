# War of Tanks — Guia de Desplegament

## Requisits previs

- **Docker Desktop** instal·lat i en funcionament  
- Connexió a la **mateixa xarxa** que el servidor (WiFi d'aula o LAN)
- Navegador web modern (Chrome, Firefox, Edge)

---

## Per al professor (servidor)

### 1. Obtenir la imatge

```bash
docker pull ghcr.io/joseptomascomellas/warofttanks:latest
```

o bé construir-la localment:

```bash
git clone https://github.com/JosepTomasComellas/WarOfTanks.git
cd WarOfTanks
docker build -t war-of-tanks .
```

### 2. Arrancar el servidor

```bash
docker run -d \
  --name wot-server \
  -e ROLE=server \
  -p 8888:8888/udp \
  -p 8080:8080 \
  war-of-tanks
```

o amb Docker Compose:

```bash
docker-compose -f docker-compose.server.yml up -d
```

### 3. Obtenir la IP del servidor

**Windows:**
```
ipconfig
```
Busca l'adaptador de xarxa actiu i apunta la "Adreça IPv4" (p.ex. `192.168.1.50`).

**macOS / Linux:**
```
ip addr show   # o ifconfig
```

### 4. Comunicar la IP als alumnes

Escriu la IP al·la pissarra o projector:

```
IP SERVIDOR: 192.168.1.50
```

### 5. Verificar que el servidor funciona

Obre un navegador a la mateixa màquina: `http://localhost:8080`  
Hauries de veure la pantalla de login de **War of Tanks**.

### Aturar el servidor

```bash
docker stop wot-server && docker rm wot-server
```

---

## Per als alumnes (clients)

### Opció A — Línia de comandes (recomanada)

**1. Descarregar la imatge**

```bash
docker pull ghcr.io/joseptomascomellas/warofttanks:latest
```

**2. Arrancar el client** (substitueix `192.168.1.50` per la IP del servidor):

```bash
docker run -d \
  --name wot-client \
  -e ROLE=client \
  -e SERVER_IP=192.168.1.50 \
  -p 8080:8080 \
  war-of-tanks
```

**3. Obrir el navegador** a:

```
http://localhost:8080
```

**4. Escriu el teu nom** i prem **PLAYER START**.

**5. Controla el tank:**

| Tecla | Acció |
|---|---|
| `W` / `↑` | Avançar |
| `S` / `↓` | Retrocedir |
| `A` / `←` | Girar esquerra |
| `D` / `→` | Girar dreta |
| `Espai` | Disparar |

---

### Opció B — Docker Compose

**1.** Crea un fitxer `.env` al mateix directori:

```env
SERVER_IP=192.168.1.50
```

**2.** Arranca:

```bash
docker-compose -f docker-compose.client.yml up -d
```

**3.** Obre `http://localhost:8080`

---

### Aturar el client

```bash
docker stop wot-client && docker rm wot-client
```

---

## Resolució de problemes

| Problema | Possible causa | Solució |
|---|---|---|
| No es connecta al servidor | Firewall bloqueja UDP:8888 | Obre el port UDP 8888 al firewall del servidor |
| La pàgina no carrega | Docker no ha arrencat | `docker logs wot-client` per veure errors |
| Ping molt alt | WiFi sobrecarregat | Connectar-se per cable Ethernet |
| El tank no es mou | Finestra del navegador no té el focus | Fes clic al canvas del joc |

---

## Arquitectura de la comunicació

```
Navegador (localhost)
    │
    │  WebSocket :8080
    ▼
Docker local (proxy)
    │
    │  UDP :8888  (xarxa d'aula)
    ▼
Docker servidor (game loop)
```

El Docker del client actua de **pont** entre el WebSocket del navegador i el UDP del servidor.  
El navegador mai fa UDP directament: sempre parla amb el proxy local.
