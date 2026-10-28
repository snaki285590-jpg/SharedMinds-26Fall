# Memory Corridor

Open index.html through Five Server / localhost. No build is required. Model/CDN downloads and Firebase need network access and the existing project permissions.

Choose **House**, **UMAP 3D**, or the additional **3D Browse** mode in the top bar. House and the original orbitable UMAP view are preserved. The chosen mode is remembered locally.

In 3D Browse, all rooms occupy one shared XYZ volume with genuine perspective. Drag to orbit around it, scroll/pinch to zoom, and right-drag/two-finger drag to pan. XYZ axes and floor/back grids show orientation. Semantic rank fills nearby spatial slots first; translucent rooms keep their existing memory previews and synthetic labels.

First click a room or name to select it and move closer. Click that same room again, press Enter, or use “Enter selected room” to advance into its existing interior. Dragging never counts as a room click. Escape or “Return to my thought” restores the overview. The Corridor button inside a room retreats into the selected room’s surrounding space. House, UMAP 3D and the indoor room remain unchanged.

“What are you thinking about?” reuses the original memory text input: it automatically saves your own memory text after 900ms. It does not erase archived objects. MiniLM embeddings rank residents by cosine similarity. Spatial slots follow semantic rank. The separate UMAP 3D mode preserves the original spatial projection. A new query smoothly reorders the world; it does not move your avatar through a fixed map. Empty rooms remain accessible while embeddings load or fail. Doorway labels may show abbreviated saved object prompts.

Try these thoughts, waiting for model status after each:
- I miss my childhood home.
- I like walking alone in New York at night.
- I remember cooking with my grandmother.

Compare the nearest names and which doors slide forward. Results depend on actual resident memories. The first model download may take a while. Use Retry semantic model after a connection failure.

Synthetic residents remain explicitly labeled. God button creates AI-generated test users using the existing proxy and writes them only after valid generation. Existing room creation, object editing and “This reminds me of…” retain their original Firebase paths. No migration or automatic test-data write was added. This remains the existing volunteered-name prototype, not authenticated identity.

Validation: JavaScript syntax checks; existing math, UMAP, room-rendering and conjuring tests; corridor query ordering and missing-data tests. Live Firebase/CDN/ML inference and browser visual verification were not run in this environment. Browser checks were attempted but no Playwright browser is installed and the sandbox blocks opening a localhost server.
