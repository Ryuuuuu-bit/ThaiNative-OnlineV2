# Stats balance — 2026-10-16

Seed 1; 1000 runs/row. Flags are shown in red in HTML-capable Markdown.

Skills are job-restricted; default swordsman uses basic, whirlwind1 and earth_break1 (no passive investment). Multi-hit skills apply each hit. This abstract offensive model does not simulate CC, dash movement or buffs. TTK is offensive kill time, including lost races (not censored). Win rate races HP concurrently; no potions, camp, movement, summons or scripted stun. Boss damage uptime 35% in 4s windows models telegraph/reposition time; enemy attacks still occur every 2s. SP regen uses shared per-second values; HP in-combat regen is 20% of its per-second value. Training weapon copies for stub classes retain +5 ATK, 0 MATK, .44s interval. PvP starts at full HP/SP, no tactical downtime; simultaneous kills split win credit 50/50.

| Class | Lv | Opponent | Mode | TTK mean/p10/p90 s | Hits mean/p10/p90 | EXP/min | Win | Flags |
|---|---:|---|---|---:|---:|---:|---:|---|
| swordsman | 1 | swordsman | duel | 4.67/4.50/4.95 | 13.2/13/14 | 0.0 | 51% | — |
| swordsman | 1 | swordsman | gvg | 6.10/5.85/6.75 | 17.8/17/18 | 0.0 | 51% | — |
| swordsman | 1 | archer | duel | 3.29/3.15/3.60 | 28.2/27/29 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 1 | archer | gvg | 4.57/4.05/4.95 | 40.3/39/41 | 0.0 | 100% | — |
| swordsman | 1 | mage | duel | 2.82/2.70/3.15 | 28.2/27/29 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 1 | mage | gvg | 3.80/3.60/4.50 | 40.3/39/41 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 1 | swordsman | duel | 10.05/9.50/10.85 | 9.8/9/10 | 0.0 | 0% | — |
| archer | 1 | swordsman | gvg | 14.02/13.10/14.90 | 12.9/12/13 | 0.0 | 0% | — |
| archer | 1 | archer | duel | 6.69/6.35/7.25 | 18.4/18/19 | 0.0 | 50% | — |
| archer | 1 | archer | gvg | 9.12/8.60/9.95 | 24.8/24/25 | 0.0 | 51% | — |
| archer | 1 | mage | duel | 5.81/5.45/6.35 | 18.4/18/19 | 0.0 | 97% | — |
| archer | 1 | mage | gvg | 7.96/7.70/8.60 | 24.8/24/25 | 0.0 | 94% | — |
| mage | 1 | swordsman | duel | 10.13/9.90/10.80 | 8.5/8/9 | 0.0 | 0% | — |
| mage | 1 | swordsman | gvg | 13.98/13.25/15.05 | 11.0/11/11 | 0.0 | 0% | — |
| mage | 1 | archer | duel | 6.98/6.70/7.20 | 16.1/16/17 | 0.0 | 4% | — |
| mage | 1 | archer | gvg | 9.31/8.55/9.90 | 21.8/21/22 | 0.0 | 6% | — |
| mage | 1 | mage | duel | 6.23/5.65/6.70 | 16.2/16/17 | 0.0 | 50% | — |
| mage | 1 | mage | gvg | 8.08/7.65/8.55 | 21.8/21/22 | 0.0 | 51% | — |
| swordsman | 10 | swordsman | duel | 8.35/8.10/9.00 | 24.2/24/25 | 0.0 | 50% | — |
| swordsman | 10 | swordsman | gvg | 11.19/10.70/12.10 | 32.2/32/33 | 0.0 | 50% | — |
| swordsman | 10 | archer | duel | 5.87/5.40/6.75 | 37.0/36/38 | 0.0 | 100% | — |
| swordsman | 10 | archer | gvg | 7.99/7.65/8.55 | 49.2/48/50 | 0.0 | 100% | — |
| swordsman | 10 | mage | duel | 5.36/4.95/5.85 | 80.8/80/81 | 0.0 | 100% | — |
| swordsman | 10 | mage | gvg | 7.08/6.75/7.65 | 107.7/107/108 | 0.0 | 100% | — |
| archer | 10 | swordsman | duel | 13.09/12.20/14.00 | 17.2/17/18 | 0.0 | 0% | — |
| archer | 10 | swordsman | gvg | 17.50/16.70/18.50 | 22.8/22/23 | 0.0 | 0% | — |
| archer | 10 | archer | duel | 9.02/8.60/9.50 | 25.0/25/25 | 0.0 | 51% | — |
| archer | 10 | archer | gvg | 12.13/11.30/13.10 | 33.4/33/34 | 0.0 | 46% | — |
| archer | 10 | mage | duel | 8.16/7.70/9.05 | 49.3/49/50 | 0.0 | 100% | — |
| archer | 10 | mage | gvg | 10.99/10.40/11.75 | 62.5/62/63 | 0.0 | 100% | — |
| mage | 10 | swordsman | duel | 37.98/37.20/38.55 | 15.8/15/16 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | swordsman | gvg | 50.62/49.70/51.55 | 20.9/20/21 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | archer | duel | 26.07/25.45/26.85 | 23.0/23/23 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | archer | gvg | 34.42/33.95/35.30 | 30.9/30/31 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | mage | duel | 24.85/23.55/25.45 | 44.6/44/45 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 10 | mage | gvg | 33.45/32.05/33.95 | 55.5/55/56 | 0.0 | 52% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 30 | swordsman | duel | 13.77/13.35/14.25 | 41.0/41/41 | 0.0 | 48% | — |
| swordsman | 30 | swordsman | gvg | 18.45/17.85/19.65 | 54.8/54/55 | 0.0 | 52% | — |
| swordsman | 30 | archer | duel | 9.69/8.95/10.65 | 42.4/42/43 | 0.0 | 100% | — |
| swordsman | 30 | archer | gvg | 12.99/12.45/13.80 | 56.0/55/57 | 0.0 | 100% | — |
| swordsman | 30 | mage | duel | 9.01/8.50/9.85 | 223.8/221/226 | 0.0 | 100% | — |
| swordsman | 30 | mage | gvg | 12.06/11.55/12.90 | 223.7/221/227 | 0.0 | 100% | — |
| archer | 30 | swordsman | duel | 14.88/14.00/15.80 | 28.5/28/29 | 0.0 | 0% | — |
| archer | 30 | swordsman | gvg | 19.80/18.95/20.75 | 37.7/37/38 | 0.0 | 0% | — |
| archer | 30 | archer | duel | 10.42/9.95/11.30 | 29.2/29/30 | 0.0 | 50% | — |
| archer | 30 | archer | gvg | 13.91/13.10/14.90 | 39.0/39/39 | 0.0 | 52% | — |
| archer | 30 | mage | duel | 9.61/9.05/10.40 | 129.7/128/131 | 0.0 | 100% | — |
| archer | 30 | mage | gvg | 13.01/12.20/14.00 | 169.6/167/172 | 0.0 | 100% | — |
| mage | 30 | swordsman | duel | 44.34/44.00/45.10 | 26.8/26/27 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | swordsman | gvg | 58.76/58.75/58.75 | 35.6/35/36 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | archer | duel | 31.33/30.35/31.70 | 27.7/27/28 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | archer | gvg | 41.79/40.80/42.15 | 36.7/36/37 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | mage | duel | 31.65/31.70/31.70 | 142.6/141/144 | 0.0 | 49% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 30 | mage | gvg | 41.70/40.30/42.15 | 152.4/150/155 | 0.0 | 52% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 50 | swordsman | duel | 16.59/16.05/17.40 | 49.7/49/50 | 0.0 | 50% | — |
| swordsman | 50 | swordsman | gvg | 22.17/21.35/23.15 | 66.0/65/67 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 50 | archer | duel | 11.49/10.65/12.00 | 48.8/48/49 | 0.0 | 100% | — |
| swordsman | 50 | archer | gvg | 15.36/14.70/16.50 | 64.8/64/65 | 0.0 | 100% | — |
| swordsman | 50 | mage | duel | 10.87/10.65/11.55 | 319.9/318/322 | 0.0 | 100% | — |
| swordsman | 50 | mage | gvg | 14.55/13.80/15.15 | 319.8/318/322 | 0.0 | 100% | — |
| archer | 50 | swordsman | duel | 17.01/16.25/18.05 | 33.9/34/34 | 0.0 | 0% | — |
| archer | 50 | swordsman | gvg | 22.81/21.65/23.90 | 45.0/45/46 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 50 | archer | duel | 11.84/11.30/12.65 | 33.4/33/34 | 0.0 | 50% | — |
| archer | 50 | archer | gvg | 15.83/14.90/16.70 | 44.4/44/45 | 0.0 | 48% | — |
| archer | 50 | mage | duel | 11.21/10.40/11.75 | 238.7/237/240 | 0.0 | 100% | — |
| archer | 50 | mage | gvg | 15.08/14.45/15.80 | 238.8/237/240 | 0.0 | 100% | — |
| mage | 50 | swordsman | duel | 48.51/48.35/49.40 | 32.8/32/33 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | swordsman | gvg | 64.78/63.95/65.00 | 43.6/43/44 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | archer | duel | 34.40/33.80/35.15 | 32.2/32/33 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | archer | gvg | 45.35/44.75/46.55 | 42.8/42/43 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | mage | duel | 35.14/35.15/35.15 | 218.3/217/220 | 0.0 | 50% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 50 | mage | gvg | 46.69/46.55/47.00 | 218.3/217/220 | 0.0 | 49% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 99 | swordsman | duel | 22.09/21.25/22.85 | 75.6/75/76 | 0.0 | 48% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 99 | swordsman | gvg | 29.65/28.85/30.40 | 100.4/100/101 | 0.0 | 52% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 99 | archer | duel | 15.06/14.45/16.05 | 59.5/59/60 | 0.0 | 100% | — |
| swordsman | 99 | archer | gvg | 20.36/19.25/20.85 | 79.2/79/80 | 0.0 | 100% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| swordsman | 99 | mage | duel | 14.56/13.65/15.25 | 445.7/444/447 | 0.0 | 100% | — |
| swordsman | 99 | mage | gvg | 19.61/18.85/20.40 | 445.7/444/447 | 0.0 | 100% | — |
| archer | 99 | swordsman | duel | 18.40/17.65/19.25 | 50.5/50/51 | 0.0 | 0% | — |
| archer | 99 | swordsman | gvg | 24.61/23.65/25.65 | 67.1/67/68 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| archer | 99 | archer | duel | 12.68/12.05/13.25 | 40.6/40/41 | 0.0 | 48% | — |
| archer | 99 | archer | gvg | 16.95/16.45/17.65 | 53.9/53/54 | 0.0 | 53% | — |
| archer | 99 | mage | duel | 12.16/11.65/12.85 | 326.2/325/327 | 0.0 | 100% | — |
| archer | 99 | mage | gvg | 16.31/15.25/17.25 | 326.3/325/327 | 0.0 | 100% | — |
| mage | 99 | swordsman | duel | 60.16/59.55/61.30 | 49.7/49/50 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | swordsman | gvg | 80.36/80.45/80.45 | 65.9/65/66 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | archer | duel | 42.24/40.95/42.70 | 39.5/39/40 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | archer | gvg | 56.02/56.05/56.05 | 52.4/52/53 | 0.0 | 0% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | mage | duel | 44.27/43.15/44.45 | 302.3/301/303 | 0.0 | 51% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
| mage | 99 | mage | gvg | 58.32/57.80/59.55 | 302.4/301/303 | 0.0 | 51% | <span style="color:#c33">🔴 PvP TTK outside 4–20s</span> |
