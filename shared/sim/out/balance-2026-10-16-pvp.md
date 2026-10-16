# Stats balance — 2026-10-16

Seed 1; 200 runs/row. Flags are shown in red in HTML-capable Markdown.

TTK is offensive kill time, including lost races (not censored). Win rate races HP concurrently; no potions, camp, movement, summons or scripted stun. Boss damage uptime 35% in 4s windows models telegraph/reposition time; enemy attacks still occur every 2s. SP regen uses shared per-second values; HP in-combat regen is 20% of its per-second value. Training weapon copies for stub classes retain +5 ATK, 0 MATK, .44s interval. PvP starts at full HP/SP, no tactical downtime; simultaneous kills split win credit 50/50.

| Class | Lv | Opponent | Mode | TTK mean/p10/p90 s | Hits mean/p10/p90 | EXP/min | Win | Flags |
|---|---:|---|---|---:|---:|---:|---:|---|
| novice_knight | 1 | novice_knight | duel | 4.63/4.30/5.20 | 13.2/13/14 | 0.0 | 50% | — |
| novice_knight | 1 | novice_knight | gvg | 6.03/5.65/6.55 | 17.8/17/18 | 0.0 | 51% | — |
| novice_knight | 1 | archer | duel | 3.48/3.40/3.85 | 28.3/27/29 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 1 | archer | gvg | 4.46/4.30/5.20 | 40.2/39/41 | 0.0 | 100% | — |
| novice_knight | 1 | mage | duel | 3.00/2.95/3.40 | 28.2/27/29 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 1 | mage | gvg | 3.97/3.85/4.30 | 40.3/39/41 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 1 | novice_knight | duel | 9.90/9.85/10.35 | 9.8/9/10 | 0.0 | 0% | — |
| archer | 1 | novice_knight | gvg | 13.54/12.60/14.40 | 12.9/13/13 | 0.0 | 0% | — |
| archer | 1 | archer | duel | 6.37/6.10/7.00 | 18.3/18/19 | 0.0 | 51% | — |
| archer | 1 | archer | gvg | 8.82/8.35/9.85 | 24.8/24/25 | 0.0 | 53% | — |
| archer | 1 | mage | duel | 5.66/5.20/6.10 | 18.4/18/19 | 0.0 | 97% | — |
| archer | 1 | mage | gvg | 7.56/7.00/8.35 | 24.8/24/25 | 0.0 | 99% | — |
| mage | 1 | novice_knight | duel | 9.59/9.45/9.90 | 8.4/8/9 | 0.0 | 0% | — |
| mage | 1 | novice_knight | gvg | 13.06/12.60/13.95 | 11.0/11/11 | 0.0 | 0% | — |
| mage | 1 | archer | duel | 6.71/6.70/6.70 | 16.1/16/17 | 0.0 | 3% | — |
| mage | 1 | archer | gvg | 8.88/8.55/9.45 | 21.8/21/22 | 0.0 | 1% | — |
| mage | 1 | mage | duel | 5.70/5.20/6.70 | 16.2/16/17 | 0.0 | 50% | — |
| mage | 1 | mage | gvg | 7.78/7.20/8.10 | 21.8/21/22 | 0.0 | 48% | — |
| novice_knight | 10 | novice_knight | duel | 8.30/8.10/9.00 | 24.2/24/25 | 0.0 | 50% | — |
| novice_knight | 10 | novice_knight | gvg | 11.10/10.80/11.70 | 32.1/32/33 | 0.0 | 47% | — |
| novice_knight | 10 | archer | duel | 6.03/5.65/6.70 | 37.0/37/37 | 0.0 | 100% | — |
| novice_knight | 10 | archer | gvg | 8.18/7.65/8.55 | 49.1/48/50 | 0.0 | 100% | — |
| novice_knight | 10 | mage | duel | 5.34/5.20/5.65 | 80.8/80/81 | 0.0 | 100% | — |
| novice_knight | 10 | mage | gvg | 7.07/6.70/7.65 | 107.7/107/108 | 0.0 | 100% | — |
| archer | 10 | novice_knight | duel | 12.48/11.70/12.75 | 17.2/17/18 | 0.0 | 0% | — |
| archer | 10 | novice_knight | gvg | 16.44/15.50/17.30 | 22.8/22/23 | 0.0 | 0% | — |
| archer | 10 | archer | duel | 8.65/8.10/9.45 | 25.0/25/25 | 0.0 | 49% | — |
| archer | 10 | archer | gvg | 11.60/11.25/12.75 | 33.4/33/34 | 0.0 | 51% | — |
| archer | 10 | mage | duel | 7.85/7.65/8.10 | 49.3/49/50 | 0.0 | 100% | — |
| archer | 10 | mage | gvg | 10.35/9.90/11.25 | 62.6/62/63 | 0.0 | 100% | — |
| mage | 10 | novice_knight | duel | 32.51/31.45/34.20 | 15.8/15/16 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | novice_knight | gvg | 45.25/43.95/46.75 | 20.8/20/21 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | archer | duel | 21.79/21.70/22.15 | 23.0/23/23 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | archer | gvg | 28.96/28.20/29.55 | 30.9/30/31 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | mage | duel | 19.85/18.90/21.20 | 44.7/44/45 | 0.0 | 53% | — |
| mage | 10 | mage | gvg | 26.71/25.85/28.20 | 55.6/55/56 | 0.0 | 51% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 30 | novice_knight | duel | 13.52/13.10/14.00 | 41.0/41/41 | 0.0 | 45% | — |
| novice_knight | 30 | novice_knight | gvg | 18.14/17.60/19.10 | 54.8/54/55 | 0.0 | 47% | — |
| novice_knight | 30 | archer | duel | 9.53/9.35/9.80 | 42.5/42/43 | 0.0 | 100% | — |
| novice_knight | 30 | archer | gvg | 13.14/13.10/13.55 | 56.0/55/57 | 0.0 | 100% | — |
| novice_knight | 30 | mage | duel | 8.80/8.45/9.35 | 223.8/221/227 | 0.0 | 100% | — |
| novice_knight | 30 | mage | gvg | 11.92/11.15/13.10 | 223.8/221/226 | 0.0 | 100% | — |
| archer | 30 | novice_knight | duel | 13.79/13.55/14.00 | 28.6/28/29 | 0.0 | 0% | — |
| archer | 30 | novice_knight | gvg | 18.60/17.60/19.05 | 37.7/37/38 | 0.0 | 0% | — |
| archer | 30 | archer | duel | 9.71/9.35/10.25 | 29.3/29/30 | 0.0 | 51% | — |
| archer | 30 | archer | gvg | 13.33/13.05/14.00 | 39.0/39/39 | 0.0 | 51% | — |
| archer | 30 | mage | duel | 9.13/8.90/9.35 | 129.9/128/132 | 0.0 | 100% | — |
| archer | 30 | mage | gvg | 12.38/11.60/13.05 | 169.4/167/172 | 0.0 | 100% | — |
| mage | 30 | novice_knight | duel | 41.94/40.80/42.15 | 26.8/26/27 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | novice_knight | gvg | 57.16/55.70/58.00 | 35.6/35/36 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | archer | duel | 29.74/29.85/29.85 | 27.7/27/28 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | archer | gvg | 39.65/38.95/40.30 | 36.8/36/37 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | mage | duel | 29.79/29.85/29.85 | 142.5/141/144 | 0.0 | 52% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | mage | gvg | 39.53/38.95/40.30 | 152.5/150/155 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 50 | novice_knight | duel | 15.92/15.35/16.70 | 49.7/49/50 | 0.0 | 58% | — |
| novice_knight | 50 | novice_knight | gvg | 21.45/20.90/22.25 | 66.0/65/67 | 0.0 | 54% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 50 | archer | duel | 11.36/10.70/12.05 | 48.8/48/49 | 0.0 | 100% | — |
| novice_knight | 50 | archer | gvg | 14.97/14.45/15.80 | 64.8/64/65 | 0.0 | 100% | — |
| novice_knight | 50 | mage | duel | 10.51/9.80/11.15 | 320.0/318/322 | 0.0 | 100% | — |
| novice_knight | 50 | mage | gvg | 14.20/13.55/14.90 | 320.0/318/321 | 0.0 | 100% | — |
| archer | 50 | novice_knight | duel | 15.52/15.20/16.55 | 33.9/33/34 | 0.0 | 0% | — |
| archer | 50 | novice_knight | gvg | 20.93/20.25/22.05 | 45.1/45/46 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 50 | archer | duel | 10.89/10.60/11.50 | 33.4/33/34 | 0.0 | 54% | — |
| archer | 50 | archer | gvg | 14.63/13.85/15.20 | 44.3/44/45 | 0.0 | 46% | — |
| archer | 50 | mage | duel | 10.19/9.70/11.05 | 238.8/237/240 | 0.0 | 100% | — |
| archer | 50 | mage | gvg | 13.79/13.40/14.30 | 238.7/237/240 | 0.0 | 100% | — |
| mage | 50 | novice_knight | duel | 46.57/46.55/46.55 | 32.8/32/33 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | novice_knight | gvg | 62.55/62.15/63.95 | 43.6/43/44 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | archer | duel | 32.73/32.75/32.75 | 32.2/32/33 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | archer | gvg | 43.89/43.40/44.75 | 42.8/42/43 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | mage | duel | 33.51/32.75/33.80 | 218.4/217/220 | 0.0 | 44% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | mage | gvg | 44.80/44.75/44.75 | 218.3/217/220 | 0.0 | 51% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | novice_knight | duel | 21.29/20.45/22.05 | 75.5/75/76 | 0.0 | 53% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | novice_knight | gvg | 28.52/27.85/29.45 | 100.5/100/101 | 0.0 | 49% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | archer | duel | 14.58/13.85/15.05 | 59.5/59/60 | 0.0 | 100% | — |
| novice_knight | 99 | archer | gvg | 19.63/19.20/20.05 | 79.2/78/80 | 0.0 | 100% | — |
| novice_knight | 99 | mage | duel | 13.92/13.45/14.65 | 445.7/444/447 | 0.0 | 100% | — |
| novice_knight | 99 | mage | gvg | 18.94/17.85/19.65 | 445.6/444/447 | 0.0 | 100% | — |
| archer | 99 | novice_knight | duel | 17.07/16.35/17.55 | 50.4/50/51 | 0.0 | 1% | — |
| archer | 99 | novice_knight | gvg | 22.77/22.05/23.65 | 67.2/67/68 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 99 | archer | duel | 12.00/11.05/12.75 | 40.6/40/41 | 0.0 | 50% | — |
| archer | 99 | archer | gvg | 15.87/15.15/16.75 | 53.9/53/54 | 0.0 | 47% | — |
| archer | 99 | mage | duel | 11.33/11.05/12.75 | 326.2/325/327 | 0.0 | 100% | — |
| archer | 99 | mage | gvg | 15.08/14.75/15.95 | 326.3/325/327 | 0.0 | 100% | — |
| mage | 99 | novice_knight | duel | 59.05/57.80/59.55 | 49.7/49/50 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | novice_knight | gvg | 78.74/78.70/78.70 | 65.9/65/66 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | archer | duel | 40.97/40.95/40.95 | 39.4/39/40 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | archer | gvg | 54.66/53.75/54.75 | 52.4/52/53 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | mage | duel | 42.71/42.70/42.70 | 302.2/301/303 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | mage | gvg | 57.36/56.50/57.80 | 302.4/301/303 | 0.0 | 46% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
