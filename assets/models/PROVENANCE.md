# Studio Male — asset provenance

- Original author/library: Microsoft / Rocketbox, male character m017.
- License: MIT, Copyright (c) 2020 Microsoft. Full text is adjacent in `LICENSE-Rocketbox.txt` and embedded in the GLB asset metadata.
- Optimized source: https://models.codelove.in/models/male-adult-09.glb
- Project adaptation: semantic bone renaming, explicit `extras.mocapHumanoid` node indices and descriptive mesh/asset metadata, 51 sparse authored expression morphs and three-segment finger/palm retargeting. No new face scan or original photorealistic sculpt is claimed.
- Appearance: dark short-sleeve T-shirt, denim jeans and casual sneakers.
- Budget: 7,428 triangles, 80 skin joints, five embedded WebP images, 895,084-byte self-contained GLB.
- Geometry compression: EXT_meshopt_compression and KHR_mesh_quantization. Textures: EXT_texture_webp.
- Rebuild: `python scripts/prepare_character.py`. The script rejects an upstream input that does not match its pinned SHA-256. Runtime use does not require downloading or rebuilding the character.

`studio-male.json` contains the output SHA-256 and explicit role map. The asset is a compact realistic real-time character; texture resolution and polygon count intentionally limit cinematic close-up fidelity.

The face morphs use existing facial bone/skin influences to author compatible expression controls. They are approximations, not facial-scan-derived blendshapes. `facial-morph-report.json` records nonzero affected vertex counts for every control. Neutral is a coefficient, not a deforming morph; 52 captured channels drive 51 expression targets.
