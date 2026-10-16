# Stats balance — 2026-10-16

Seed 1; 200 runs/row. Flags are shown in red in HTML-capable Markdown.

TTK is offensive kill time, including lost races (not censored). Win rate races HP concurrently; no potions, camp, movement, summons or scripted stun. Boss damage uptime 35% in 4s windows models telegraph/reposition time; enemy attacks still occur every 2s. SP/HP regen uses shared per-5s values. Training weapon copies for stub classes retain +5 ATK, 0 MATK, .44s interval. PvP starts at full HP/SP, no tactical downtime; simultaneous kills split win credit 50/50.

| Class | Lv | Opponent | Mode | TTK mean/p10/p90 s | Hits mean/p10/p90 | EXP/min | Win | Flags |
|---|---:|---|---|---:|---:|---:|---:|---|
| novice_knight | 1 | novice_knight | duel | 5.24/5.20/5.65 | 13.2/13/14 | 0.0 | 52% | — |
| novice_knight | 1 | novice_knight | gvg | 6.77/6.55/7.00 | 17.8/17/18 | 0.0 | 49% | — |
| novice_knight | 1 | archer | duel | 3.89/3.85/3.85 | 21.6/21/22 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 1 | archer | gvg | 5.08/4.75/5.20 | 31.2/31/32 | 0.0 | 100% | — |
| novice_knight | 1 | mage | duel | 3.49/3.40/3.85 | 28.2/27/29 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 1 | mage | gvg | 4.50/4.30/5.20 | 40.2/39/41 | 0.0 | 100% | — |
| archer | 1 | novice_knight | duel | 8.21/7.90/8.80 | 9.8/9/10 | 0.0 | 0% | — |
| archer | 1 | novice_knight | gvg | 11.50/11.05/12.40 | 12.9/13/13 | 0.0 | 0% | — |
| archer | 1 | archer | duel | 5.04/4.55/5.90 | 14.9/14/15 | 0.0 | 47% | — |
| archer | 1 | archer | gvg | 7.72/7.45/8.35 | 19.9/20/20 | 0.0 | 53% | — |
| archer | 1 | mage | duel | 4.36/4.10/4.55 | 18.4/18/19 | 0.0 | 100% | — |
| archer | 1 | mage | gvg | 6.12/5.90/6.80 | 24.8/24/25 | 0.0 | 100% | — |
| mage | 1 | novice_knight | duel | 10.50/9.90/11.25 | 8.4/8/9 | 0.0 | 0% | — |
| mage | 1 | novice_knight | gvg | 14.47/13.50/15.30 | 11.0/11/11 | 0.0 | 0% | — |
| mage | 1 | archer | duel | 7.06/6.70/7.65 | 13.0/13/13 | 0.0 | 0% | — |
| mage | 1 | archer | gvg | 9.59/9.45/9.90 | 17.8/17/18 | 0.0 | 0% | — |
| mage | 1 | mage | duel | 5.96/5.65/6.70 | 16.2/16/17 | 0.0 | 50% | — |
| mage | 1 | mage | gvg | 8.39/8.10/9.00 | 21.8/21/22 | 0.0 | 47% | — |
| novice_knight | 10 | novice_knight | duel | 13.03/12.60/13.95 | 33.7/33/34 | 0.0 | 49% | — |
| novice_knight | 10 | novice_knight | gvg | 17.46/16.65/18.45 | 45.6/45/46 | 0.0 | 50% | — |
| novice_knight | 10 | archer | duel | 9.86/9.45/10.35 | 30.1/30/31 | 0.0 | 99% | — |
| novice_knight | 10 | archer | gvg | 11.47/10.85/12.20 | 39.9/40/40 | 0.0 | 100% | — |
| novice_knight | 10 | mage | duel | 7.63/7.25/8.15 | 66.3/65/67 | 0.0 | 100% | — |
| novice_knight | 10 | mage | gvg | 10.37/9.95/10.85 | 92.3/90/94 | 0.0 | 100% | — |
| archer | 10 | novice_knight | duel | 11.62/11.15/12.50 | 24.9/25/25 | 0.0 | 1% | — |
| archer | 10 | novice_knight | gvg | 15.23/14.75/16.10 | 32.9/32/34 | 0.0 | 0% | — |
| archer | 10 | archer | duel | 8.82/8.45/9.80 | 22.5/22/23 | 0.0 | 47% | — |
| archer | 10 | archer | gvg | 11.65/11.15/12.50 | 29.8/29/30 | 0.0 | 49% | — |
| archer | 10 | mage | duel | 7.05/6.80/7.25 | 49.4/49/50 | 0.0 | 100% | — |
| archer | 10 | mage | gvg | 9.29/9.05/9.95 | 62.6/62/63 | 0.0 | 100% | — |
| mage | 10 | novice_knight | duel | 20.08/19.10/21.35 | 22.9/22/23 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | novice_knight | gvg | 28.68/27.65/29.90 | 30.4/30/31 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | archer | duel | 14.19/13.70/14.60 | 20.7/20/21 | 0.0 | 0% | — |
| mage | 10 | archer | gvg | 19.65/18.65/20.45 | 27.3/27/28 | 0.0 | 0% | — |
| mage | 10 | mage | duel | 13.04/12.75/13.70 | 44.7/44/45 | 0.0 | 51% | — |
| mage | 10 | mage | gvg | 17.58/16.85/18.65 | 55.6/55/56 | 0.0 | 50% | — |
| novice_knight | 30 | novice_knight | duel | 17.33/16.70/18.05 | 45.1/45/46 | 0.0 | 48% | — |
| novice_knight | 30 | novice_knight | gvg | 23.38/22.70/24.50 | 59.9/59/60 | 0.0 | 48% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 30 | archer | duel | 11.32/10.85/11.75 | 40.4/40/41 | 0.0 | 100% | — |
| novice_knight | 30 | archer | gvg | 15.26/14.45/16.25 | 53.8/53/54 | 0.0 | 100% | — |
| novice_knight | 30 | mage | duel | 10.31/9.95/10.85 | 219.9/217/222 | 0.0 | 100% | — |
| novice_knight | 30 | mage | gvg | 13.80/13.10/14.45 | 219.9/218/223 | 0.0 | 100% | — |
| archer | 30 | novice_knight | duel | 15.67/15.35/16.70 | 33.5/33/34 | 0.0 | 0% | — |
| archer | 30 | novice_knight | gvg | 21.19/20.45/21.80 | 44.7/44/45 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 30 | archer | duel | 10.23/9.50/10.85 | 29.9/30/30 | 0.0 | 48% | — |
| archer | 30 | archer | gvg | 15.75/15.35/16.70 | 39.8/39/40 | 0.0 | 54% | — |
| archer | 30 | mage | duel | 9.25/8.60/9.95 | 152.2/151/153 | 0.0 | 100% | — |
| archer | 30 | mage | gvg | 12.39/11.75/13.10 | 171.0/169/173 | 0.0 | 100% | — |
| mage | 30 | novice_knight | duel | 37.99/37.55/38.45 | 30.9/31/31 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | novice_knight | gvg | 52.26/50.30/53.90 | 40.9/40/41 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | archer | duel | 27.17/26.00/28.25 | 27.7/27/28 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | archer | gvg | 37.35/36.50/37.55 | 36.8/36/37 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | mage | duel | 25.24/25.10/26.00 | 142.7/141/144 | 0.0 | 51% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | mage | gvg | 33.71/32.45/34.70 | 152.3/150/155 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 50 | novice_knight | duel | 20.49/19.55/21.35 | 52.8/52/53 | 0.0 | 51% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 50 | novice_knight | gvg | 27.53/26.90/28.70 | 70.2/70/71 | 0.0 | 52% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 50 | archer | duel | 12.71/12.20/13.55 | 47.2/47/48 | 0.0 | 100% | — |
| novice_knight | 50 | archer | gvg | 17.17/16.25/18.05 | 62.8/62/63 | 0.0 | 100% | — |
| novice_knight | 50 | mage | duel | 11.98/11.75/12.65 | 321.0/320/322 | 0.0 | 100% | — |
| novice_knight | 50 | mage | gvg | 16.36/15.80/17.15 | 321.1/320/322 | 0.0 | 100% | — |
| archer | 50 | novice_knight | duel | 16.26/15.85/16.65 | 38.0/37/38 | 0.0 | 0% | — |
| archer | 50 | novice_knight | gvg | 21.87/21.25/22.85 | 50.7/50/51 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 50 | archer | duel | 11.73/11.25/12.45 | 34.2/34/35 | 0.0 | 50% | — |
| archer | 50 | archer | gvg | 13.82/13.25/14.45 | 45.5/45/46 | 0.0 | 51% | — |
| archer | 50 | mage | duel | 9.64/9.25/10.45 | 245.5/245/247 | 0.0 | 100% | — |
| archer | 50 | mage | gvg | 13.09/12.85/13.65 | 245.5/244/246 | 0.0 | 100% | — |
| mage | 50 | novice_knight | duel | 54.32/52.70/55.85 | 36.3/36/37 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | novice_knight | gvg | 71.03/69.75/72.95 | 48.3/48/49 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | archer | duel | 37.53/37.50/37.50 | 32.6/32/33 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | archer | gvg | 50.39/50.40/50.40 | 43.2/43/44 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | mage | duel | 37.44/37.50/37.50 | 222.7/222/224 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | mage | gvg | 48.94/47.15/50.40 | 222.6/222/223 | 0.0 | 49% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | novice_knight | duel | 25.35/24.05/26.65 | 76.1/75/77 | 0.0 | 52% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | novice_knight | gvg | 34.49/33.25/35.65 | 101.2/100/102 | 0.0 | 53% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | archer | duel | 17.50/16.65/18.25 | 57.9/57/58 | 0.0 | 46% | — |
| novice_knight | 99 | archer | gvg | 23.87/22.85/24.85 | 77.0/76/78 | 0.0 | 42% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| novice_knight | 99 | mage | duel | 15.03/14.45/15.65 | 486.5/484/489 | 0.0 | 100% | — |
| novice_knight | 99 | mage | gvg | 20.37/19.65/21.25 | 486.5/484/489 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 99 | novice_knight | duel | 17.46/16.85/18.45 | 52.4/52/53 | 0.0 | 56% | — |
| archer | 99 | novice_knight | gvg | 23.71/22.85/24.85 | 69.6/69/70 | 0.0 | 53% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 99 | archer | duel | 12.23/11.65/12.85 | 40.7/40/41 | 0.0 | 52% | — |
| archer | 99 | archer | gvg | 16.63/15.65/17.25 | 54.0/53/55 | 0.0 | 50% | — |
| archer | 99 | mage | duel | 11.78/11.25/12.45 | 361.6/359/364 | 0.0 | 100% | — |
| archer | 99 | mage | gvg | 15.91/15.25/16.85 | 361.7/359/364 | 0.0 | 100% | — |
| mage | 99 | novice_knight | duel | 83.70/83.80/83.80 | 51.5/51/52 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | novice_knight | gvg | 106.66/103.00/109.40 | 68.4/68/69 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | archer | duel | 53.11/51.80/55.85 | 39.6/39/40 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | archer | gvg | 71.12/71.00/71.00 | 52.5/52/53 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | mage | duel | 53.58/51.80/55.85 | 334.9/332/337 | 0.0 | 43% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | mage | gvg | 70.87/71.00/71.00 | 334.7/333/337 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
