# War of Tanks

<p align="center">
  <img src="docs/banner.svg" alt="War of Tanks" width="860"/>
</p>

[![Build & Publish](https://github.com/JosepTomasComellas/WarOfTanks/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/JosepTomasComellas/WarOfTanks/actions/workflows/docker-publish.yml)

Joc de batalla de tanks en xarxa per a competicions d'aula.  
Fins a **120 jugadors simultanis** · Protocol UDP port 8888 · Estètica retro arcade.

---

## Desplegament ràpid

### Servidor (professor)

```bash
git clone https://github.com/JosepTomasComellas/WarOfTanks.git
cd WarOfTanks
docker compose -f docker-compose.server.yml up --build -d
```

Obtén la IP de la màquina (`ip addr` / `hostname -I`) i comunica-la als alumnes.  
Panell d'administració: `http://<IP>:8888/admin.html`

### Client (cada alumne)

1. Descarrega el repositori (o només `docker-compose.yml` + `.env.example`)
2. Copia `.env.example` → `.env` i edita la IP del servidor:

```env
SERVER_IP=192.168.1.50
```

3. Arranca i obre el navegador:

```bash
docker compose up --build -d
# → http://localhost:8888
```

Consulta el **[MANUAL.md](MANUAL.md)** per a la guia completa pas a pas.

---

## Configuració del servidor

Totes les opcions s'editen a `docker-compose.server.yml`:

| Variable | Valor per defecte | Descripció |
|----------|------------------|------------|
| `WALL_DENSITY` | `20` | Densitat de parets (0 = camp buit · 100 = molt dens) |
| `MAX_TABS` | `1` | Pestanyes per alumne (1 = una sola · 0 = sense límit) |
| `LOGO_URL` | *(buit)* | URL externa del logo (buit = logo per defecte) |
| `ADMIN_PASSWORD` | *(buit)* | Contrasenya del panell admin (buit = accés lliure) |
| `HTTPS_ENABLED` | `false` | Activar HTTPS (cal `SSL_CERT` i `SSL_KEY`) |

---

## Panell d'administració

Accessible a `http://<IP>:8888/admin.html` (o HTTPS si està activat).

- **Vista en directe** del camp de batalla (canvas 480×360, actualitzat cada 200 ms)
- **Classificació** en temps real amb punts, vides i estat de cada jugador
- **Nova Ronda** — mapa nou, restaura vides, manté puntuació
- **Reset Puntuació** — posa tots els marcadors a zero
- **Tancar Partida** — desconnecta tots els jugadors i els retorna al login
- **Kick** — expulsa un jugador concret
- **Protecció per contrasenya** via `ADMIN_PASSWORD` (opcional)

---

## Mecànica del joc

- Mapa 80×60 tiles generat aleatòriament cada ronda
- **Parets destructibles** — les bales destrueixen parets interiors; el perímetre és indestructible
- 3 vides per jugador · reaparició automàtica
- +100 pts per eliminació · +500 pts per guanyar la ronda
- Botó **✕ SORTIR** per abandonar la partida sense tancar el Docker

---

## Tecnologia

| Component | Tecnologia |
|-----------|------------|
| Servidor de joc | Node.js + UDP (`dgram`) |
| Proxy client | Node.js + WebSocket (`ws`) |
| Interfície web | HTML5 Canvas + JS pur |
| So | Web Audio API (sense fitxers externs) |
| Transport | UDP :8888 (joc) · TCP :8888 (web + admin) |
| Contenidors | Docker · imatge única, rol per `ROLE=server\|client` |

---

## Llicència

MIT · Projecte educatiu Salesians
