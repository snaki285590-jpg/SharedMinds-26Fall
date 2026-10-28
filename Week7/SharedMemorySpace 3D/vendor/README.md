UMAP-js 1.4.0

Source: https://cdn.jsdelivr.net/npm/umap-js@1.4.0/lib/umap-js.min.js
Repository: https://github.com/PAIR-code/umap-js
License: UMAP-LICENSE is the unmodified upstream LICENSE distributed with 1.4.0 (Apache-2.0). Its npm metadata separately lists MIT; the upstream license file is retained here.

The browser bundle includes its dependencies, avoiding the broken transitive dependency combination observed when using an online ESM repackager. Only the UMD receiver was changed from `this` to `globalThis` to allow module-worker loading, and a named `UMAP` ESM export was appended. Algorithm and bundled dependency code are unchanged.
