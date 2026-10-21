# Game-development skills for The Beginning Online

Project-local skills selected from [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills).

- Source commit: [`0a70cfc64672d512c5b5b6006b5dcb5cf90dbdbd`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/0a70cfc64672d512c5b5b6006b5dcb5cf90dbdbd).
- Installed on 2026-10-21 with Codex's `skill-installer`, scoped to this repository.
- The 12 skill folders retain their upstream contents, including bundled references and asset tools.
- License: [Apache-2.0](LICENSE); attribution and trademarks: [NOTICE](NOTICE).
- Routing and project constraints: [AGENTS.md](../../AGENTS.md#game-development-skills).

| Installed folder | Upstream path | Use here |
| --- | --- | --- |
| `pixijs-rendering` | `skills/web-engines/pixijs-rendering` | PixiJS sprites, textures, display tree and events |
| `threejs-scene-setup` | `skills/web-engines/threejs-scene-setup` | Three.js scene, camera, render loop and disposal |
| `threejs-materials-lighting` | `skills/web-engines/threejs-materials-lighting` | Painted scene materials, lighting and shadows |
| `create-game-assets` | `skills/disciplines/create-game-assets` | Art consistency, asset provenance and validation |
| `performance-optimization` | `skills/disciplines/performance-optimization` | Measure CPU/GPU, draw calls and memory before changing code |
| `game-feel` | `skills/disciplines/game-feel` | Cosmetic combat feedback and animation timing |
| `game-ui-ux` | `skills/disciplines/game-ui-ux` | HUD, menus, touch layouts and accessibility |
| `camera-systems` | `skills/disciplines/camera-systems` | Follow, framing and cosmetic shake |
| `game-ai` | `skills/disciplines/game-ai` | Server-owned enemy behavior and pathfinding |
| `save-systems` | `skills/disciplines/save-systems` | Server persistence, compatibility and migrations |
| `dialogue-systems` | `skills/disciplines/dialogue-systems` | NPC conversation flow and conditions |
| `rpg` | `skills/genres/rpg` | Existing stats, equipment, combat and quest systems |

Read only the skill needed for the current task, then its references as needed. Repository rules and explicit user instructions take precedence. Other-engine examples are concepts to adapt to our existing TypeScript code, not dependencies to add. Cross-links naming other skills do not mean those skills are installed.

At installation, the project declares Three.js `0.185.0` and PixiJS `8.22.0`; upstream examples target r186 and 8.21. Always check the current dependency versions before using an API. The generic upstream router is intentionally omitted: it selects one engine, while our local routing follows the file being edited.

The Python asset utilities are optional offline tools, not part of the game build. Their `requirements.txt` is upstream documentation; no Python packages or game dependencies were installed. Prefer the project's existing packers/manifests and available image/sprite tools, and inspect tool inputs and output paths before running them.

To update, inspect a new upstream commit, reinstall the same selected paths with `skill-installer` into a separate staging directory, compare the changes, then update the recorded commit here. Preserve `LICENSE`, `NOTICE` and all project-specific rules.
