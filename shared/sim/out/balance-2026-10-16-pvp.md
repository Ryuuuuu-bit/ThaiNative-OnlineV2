# Stats balance — 2026-10-16

Seed 1; 1000 runs/row. Flags are shown in red in HTML-capable Markdown.

TTK is offensive kill time, including lost races (not censored). Win rate races HP concurrently; no potions, camp, movement, summons or scripted stun. Boss damage uptime 35% in 4s windows models telegraph/reposition time; enemy attacks still occur every 2s. SP regen uses shared per-second values; HP in-combat regen is 20% of its per-second value. Training weapon copies for stub classes retain +5 ATK, 0 MATK, .44s interval. PvP starts at full HP/SP, no tactical downtime; simultaneous kills split win credit 50/50.

| Class | Lv | Opponent | Mode | TTK mean/p10/p90 s | Hits mean/p10/p90 | EXP/min | Win | Flags |
|---|---:|---|---|---:|---:|---:|---:|---|
| novice_knight | 1 | novice_knight | duel | 4.64/4.30/5.20 | 13.2/13/14 | 0.0 | 51% | — |
| novice_knight | 1 | novice_knight | gvg | 6.01/5.65/6.55 | 17.8/17/18 | 0.0 | 51% | — |
| novice_knight | 1 | archer | duel | 3.49/3.40/3.85 | 28.2/27/29 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 1 | archer | gvg | 4.47/4.30/5.20 | 40.3/39/41 | 0.0 | 100% | — |
| novice_knight | 1 | mage | duel | 2.99/2.50/3.40 | 28.2/27/29 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 1 | mage | gvg | 3.97/3.85/4.30 | 40.2/39/41 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 1 | novice_knight | duel | 9.89/9.85/10.35 | 9.8/9/10 | 0.0 | 0% | — |
| archer | 1 | novice_knight | gvg | 13.46/12.60/14.40 | 12.9/12/13 | 0.0 | 0% | — |
| archer | 1 | archer | duel | 6.38/6.10/7.00 | 18.4/18/19 | 0.0 | 49% | — |
| archer | 1 | archer | gvg | 8.84/8.35/9.85 | 24.8/24/25 | 0.0 | 53% | — |
| archer | 1 | mage | duel | 5.64/5.20/6.10 | 18.4/18/19 | 0.0 | 97% | — |
| archer | 1 | mage | gvg | 7.58/7.00/8.35 | 24.8/24/25 | 0.0 | 98% | — |
| mage | 1 | novice_knight | duel | 9.61/9.45/9.90 | 8.5/8/9 | 0.0 | 0% | — |
| mage | 1 | novice_knight | gvg | 13.09/12.60/13.50 | 11.0/11/11 | 0.0 | 0% | — |
| mage | 1 | archer | duel | 6.70/6.70/6.70 | 16.2/16/17 | 0.0 | 4% | — |
| mage | 1 | archer | gvg | 8.87/8.55/9.45 | 21.8/21/22 | 0.0 | 2% | — |
| mage | 1 | mage | duel | 5.73/5.20/6.70 | 16.2/16/17 | 0.0 | 48% | — |
| mage | 1 | mage | gvg | 7.76/7.20/8.10 | 21.8/21/22 | 0.0 | 49% | — |
| novice_knight | 10 | novice_knight | duel | 8.32/8.10/9.00 | 24.3/24/25 | 0.0 | 50% | — |
| novice_knight | 10 | novice_knight | gvg | 11.10/10.80/11.70 | 32.1/32/33 | 0.0 | 49% | — |
| novice_knight | 10 | archer | duel | 5.99/5.65/6.70 | 37.0/36/38 | 0.0 | 100% | — |
| novice_knight | 10 | archer | gvg | 8.16/7.65/8.55 | 49.2/48/50 | 0.0 | 100% | — |
| novice_knight | 10 | mage | duel | 5.36/5.20/5.65 | 80.8/80/81 | 0.0 | 100% | — |
| novice_knight | 10 | mage | gvg | 7.06/6.70/7.65 | 107.7/107/108 | 0.0 | 100% | — |
| archer | 10 | novice_knight | duel | 12.49/11.70/12.75 | 17.2/17/18 | 0.0 | 0% | — |
| archer | 10 | novice_knight | gvg | 16.45/15.50/17.30 | 22.8/22/23 | 0.0 | 0% | — |
| archer | 10 | archer | duel | 8.65/8.10/9.45 | 25.0/25/25 | 0.0 | 50% | — |
| archer | 10 | archer | gvg | 11.66/11.25/12.75 | 33.4/33/34 | 0.0 | 48% | — |
| archer | 10 | mage | duel | 7.84/7.65/8.10 | 49.4/49/50 | 0.0 | 100% | — |
| archer | 10 | mage | gvg | 10.35/9.90/11.25 | 62.5/62/63 | 0.0 | 100% | — |
| mage | 10 | novice_knight | duel | 32.59/31.45/34.20 | 15.8/15/16 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | novice_knight | gvg | 45.09/43.95/46.75 | 20.8/20/21 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | archer | duel | 21.80/21.20/22.15 | 23.0/23/23 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | archer | gvg | 28.96/28.20/29.55 | 30.9/30/31 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | mage | duel | 19.88/19.35/21.20 | 44.6/44/45 | 0.0 | 52% | — |
| mage | 10 | mage | gvg | 26.72/25.85/28.20 | 55.6/55/56 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 30 | novice_knight | duel | 13.47/13.10/14.00 | 41.0/41/41 | 0.0 | 50% | — |
| novice_knight | 30 | novice_knight | gvg | 18.06/17.60/19.10 | 54.8/54/55 | 0.0 | 50% | — |
| novice_knight | 30 | archer | duel | 9.56/9.35/9.80 | 42.4/42/43 | 0.0 | 100% | — |
| novice_knight | 30 | archer | gvg | 13.14/13.10/13.55 | 56.0/55/57 | 0.0 | 100% | — |
| novice_knight | 30 | mage | duel | 8.82/8.45/9.35 | 223.8/221/227 | 0.0 | 100% | — |
| novice_knight | 30 | mage | gvg | 11.92/11.15/13.10 | 223.8/221/226 | 0.0 | 100% | — |
| archer | 30 | novice_knight | duel | 13.77/13.55/14.45 | 28.5/28/29 | 0.0 | 0% | — |
| archer | 30 | novice_knight | gvg | 18.60/17.60/19.05 | 37.7/37/38 | 0.0 | 0% | — |
| archer | 30 | archer | duel | 9.71/9.35/10.25 | 29.2/29/30 | 0.0 | 51% | — |
| archer | 30 | archer | gvg | 13.31/13.05/14.00 | 39.0/39/39 | 0.0 | 50% | — |
| archer | 30 | mage | duel | 9.13/8.90/9.35 | 129.7/128/131 | 0.0 | 100% | — |
| archer | 30 | mage | gvg | 12.35/11.60/13.05 | 169.6/167/172 | 0.0 | 100% | — |
| mage | 30 | novice_knight | duel | 41.95/40.80/42.15 | 26.8/26/27 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | novice_knight | gvg | 57.23/56.20/58.00 | 35.6/35/36 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | archer | duel | 29.76/29.85/29.85 | 27.8/27/28 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | archer | gvg | 39.65/38.95/40.30 | 36.8/36/37 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | mage | duel | 29.76/29.85/29.85 | 142.6/141/144 | 0.0 | 51% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | mage | gvg | 39.52/38.95/40.30 | 152.4/150/155 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 50 | novice_knight | duel | 16.03/15.35/16.70 | 49.7/49/50 | 0.0 | 50% | — |
| novice_knight | 50 | novice_knight | gvg | 21.46/20.90/22.25 | 66.0/65/67 | 0.0 | 51% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 50 | archer | duel | 11.34/10.70/12.05 | 48.7/48/49 | 0.0 | 100% | — |
| novice_knight | 50 | archer | gvg | 14.97/14.45/15.80 | 64.8/64/65 | 0.0 | 100% | — |
| novice_knight | 50 | mage | duel | 10.57/9.80/11.15 | 319.9/318/322 | 0.0 | 100% | — |
| novice_knight | 50 | mage | gvg | 14.17/13.55/14.90 | 319.8/318/322 | 0.0 | 100% | — |
| archer | 50 | novice_knight | duel | 15.55/15.20/16.55 | 33.9/34/34 | 0.0 | 0% | — |
| archer | 50 | novice_knight | gvg | 20.96/20.25/22.05 | 45.0/45/45 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 50 | archer | duel | 10.94/10.60/11.50 | 33.4/33/34 | 0.0 | 50% | — |
| archer | 50 | archer | gvg | 14.59/13.85/15.20 | 44.4/44/45 | 0.0 | 49% | — |
| archer | 50 | mage | duel | 10.20/9.70/11.05 | 238.8/237/240 | 0.0 | 100% | — |
| archer | 50 | mage | gvg | 13.81/13.40/14.30 | 238.8/237/240 | 0.0 | 100% | — |
| mage | 50 | novice_knight | duel | 46.59/46.55/46.55 | 32.8/32/33 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | novice_knight | gvg | 62.56/62.15/63.95 | 43.6/43/44 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | archer | duel | 32.75/32.75/32.75 | 32.2/32/33 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | archer | gvg | 43.82/43.40/44.75 | 42.8/42/43 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | mage | duel | 33.44/32.75/33.80 | 218.3/217/220 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | mage | gvg | 44.79/44.75/44.75 | 218.2/217/220 | 0.0 | 52% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | novice_knight | duel | 21.28/20.45/22.05 | 75.6/75/76 | 0.0 | 53% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | novice_knight | gvg | 28.51/27.85/29.45 | 100.5/100/101 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | archer | duel | 14.51/13.85/15.05 | 59.5/59/60 | 0.0 | 100% | — |
| novice_knight | 99 | archer | gvg | 19.65/19.20/20.45 | 79.2/79/80 | 0.0 | 100% | — |
| novice_knight | 99 | mage | duel | 13.94/13.45/14.65 | 445.7/444/447 | 0.0 | 100% | — |
| novice_knight | 99 | mage | gvg | 18.93/17.85/19.65 | 445.7/444/447 | 0.0 | 100% | — |
| archer | 99 | novice_knight | duel | 17.06/16.35/17.55 | 50.5/50/51 | 0.0 | 0% | — |
| archer | 99 | novice_knight | gvg | 22.77/22.05/23.65 | 67.1/66/68 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 99 | archer | duel | 11.99/11.05/12.75 | 40.6/40/41 | 0.0 | 51% | — |
| archer | 99 | archer | gvg | 15.85/15.15/16.75 | 53.9/53/54 | 0.0 | 51% | — |
| archer | 99 | mage | duel | 11.31/11.05/11.85 | 326.2/325/327 | 0.0 | 100% | — |
| archer | 99 | mage | gvg | 15.11/14.75/15.95 | 326.3/325/327 | 0.0 | 100% | — |
| mage | 99 | novice_knight | duel | 59.02/57.80/59.55 | 49.7/49/50 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | novice_knight | gvg | 78.76/78.70/78.70 | 65.9/65/66 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | archer | duel | 40.96/40.95/40.95 | 39.5/39/40 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | archer | gvg | 54.66/53.75/54.75 | 52.4/52/53 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | mage | duel | 42.70/42.70/42.70 | 302.3/301/303 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | mage | gvg | 57.30/56.50/57.80 | 302.4/301/303 | 0.0 | 49% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
