# War of Tanks

[![Build & Publish](https://github.com/JosepTomasComellas/WarOfTanks/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/JosepTomasComellas/WarOfTanks/actions/workflows/docker-publish.yml)

Joc de batalla de tanks en xarxa per a competicions d'aula.  
Fins a **120 jugadors simultanis** · Protocol UDP port 8888 · Estètica retro arcade.

---

## Descripció

Cada alumne executa un contenidor Docker a la seva màquina.  
El professor designa un ordinador com a servidor.  
Tots obren el navegador i juguen en temps real.

## Tecnologia

| Component | Tecnologia |
|---|---|
| Servidor de joc | Node.js + UDP (`dgram`) |
| Proxy client | Node.js + WebSocket (`ws`) |
| Interfície web | HTML5 Canvas + JS pur |
| Transport en xarxa | UDP port 8888 |
| Contenidors | Docker (imatge única) |

## Arquitectura

```
Browser ──WS:8080──► [Docker local] ──UDP:8888──► [Docker servidor]
```

- **Mateixa imatge Docker** per a tothom; el rol es defineix via `ROLE=server|client`  
- El **servidor** executa el game loop autoritatiu (física, col·lisions, puntuació)  
- El **proxy client** tradueix WebSocket ↔ UDP per cada connexió de navegador

## Mecànica

- Mapa generat aleatòriament cada ronda (cel·les + corredors)
- 3 vides per jugador · Reaparició automàtica al cap de 3 s
- +100 punts per eliminació · +500 punts per guanyar la ronda
- Marcador en temps real a la cantonada superior dreta

## Desplegament ràpid

Vegeu [DEPLOY.md](DEPLOY.md) per a les instruccions completes.

```bash
# Servidor
docker run -d -e ROLE=server -p 8888:8888/udp -p 8080:8080 war-of-tanks

# Client (cada alumne)
docker run -d -e ROLE=client -e SERVER_IP=<IP_SERVIDOR> -p 8080:8080 war-of-tanks
```

## Llicència

MIT · Projecte educatiu Salesians
