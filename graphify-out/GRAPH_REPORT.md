# Graph Report - ss-moniepoint-app  (2026-07-06)

## Corpus Check
- 39 files · ~11,512 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 241 nodes · 379 edges · 18 communities (17 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb41207d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 13 edges
2. `compilerOptions` - 13 edges
3. `compilerOptions` - 12 edges
4. `memoryDb()` - 8 edges
5. `getDb()` - 7 edges
6. `reconcile()` - 6 edges
7. `reserve()` - 6 edges
8. `scripts` - 6 edges
9. `ss-moniepoint-app` - 6 edges
10. `scripts` - 5 edges

## Surprising Connections (you probably didn't know these)
- `reconcile()` --calls--> `markUnmappedResolved()`  [EXTRACTED]
  api/src/domain/matcher.ts → api/src/domain/suspense.ts
- `reconcile()` --calls--> `upsertUnmapped()`  [EXTRACTED]
  api/src/domain/matcher.ts → api/src/domain/suspense.ts
- `seed()` --calls--> `encryptSecret()`  [EXTRACTED]
  api/src/routes/webhook.test.ts → api/src/lib/cypher.ts
- `seed()` --calls--> `memoryDb()`  [EXTRACTED]
  api/src/routes/webhook.test.ts → api/src/store/db.ts
- `seed()` --calls--> `setDb()`  [EXTRACTED]
  api/src/routes/webhook.test.ts → api/src/store/db.ts

## Import Cycles
- None detected.

## Communities (18 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (15): //, compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleDetection, moduleResolution (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (15): dependencies, hono, jose, devDependencies, @types/bun, typescript, module, name (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit, skipLibCheck (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (13): devDependencies, @types/bun, typescript, name, private, scripts, build:ui, demo (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (17): dependencies, react, react-dom, devDependencies, @types/react, @types/react-dom, typescript, vite (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (6): Auth & env, Develop, Layout, ss-moniepoint-app, Stack, Status

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (14): api, AppConfig, j(), naira(), sessionToken(), Terminal, Unmapped, WebhookSetup (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (17): MatchOutcome, reconcile(), listUnmapped(), markUnmappedResolved(), resolveWorkspace(), upsertUnmapped(), InboundTransfer, MoniepointWebhook (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (25): app, bearer(), PlatformClaims, platformKey(), sessionAuth, SessionVars, _setPlatformKey(), verify() (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (12): appKey(), decoder, decryptSecret(), encoder, encryptSecret(), seed(), port, server (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (11): H, makeTestKeys(), signProvision(), signSession(), TestKeys, DEFAULT_EVENTS, getMoniepointClient(), httpMoniepoint() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (6): formatMinor(), InstructionsPaymentIntent, reserve(), ReserveDeps, toIntent(), TerminalRow

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (6): H, jj(), json(), mock, payload, sig

### Community 17 - "Community 17"
Cohesion: 0.50
Nodes (3): body, sig, verifyWebhookAuth()

## Knowledge Gaps
- **109 isolated node(s):** `name`, `private`, `type`, `module`, `dev` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `memoryDb()` connect `Community 10` to `Community 8`, `Community 14`, `Community 15`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `getDb()` connect `Community 9` to `Community 8`, `Community 10`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `verifyWebhookAuth()` connect `Community 17` to `Community 8`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._