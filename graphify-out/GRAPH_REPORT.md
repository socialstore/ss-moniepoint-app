# Graph Report - ss-moniepoint-app  (2026-07-11)

## Corpus Check
- 53 files · ~15,519 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 342 nodes · 580 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5c8adb2c`
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

## God Nodes (most connected - your core abstractions)
1. `cn()` - 36 edges
2. `compilerOptions` - 15 edges
3. `compilerOptions` - 15 edges
4. `compilerOptions` - 12 edges
5. `getDb()` - 9 edges
6. `memoryDb()` - 9 edges
7. `reconcile()` - 6 edges
8. `reserve()` - 6 edges
9. `scripts` - 6 edges
10. `tailwind` - 6 edges

## Surprising Connections (you probably didn't know these)
- `MoniepointMark()` --calls--> `cn()`  [INFERRED]
  ui/src/App.tsx → ui/src/lib/utils.ts
- `StatusPill()` --calls--> `cn()`  [INFERRED]
  ui/src/App.tsx → ui/src/lib/utils.ts
- `seed()` --calls--> `encryptSecret()`  [EXTRACTED]
  api/src/routes/webhook.test.ts → api/src/lib/cypher.ts
- `App()` --calls--> `useSafeArea()`  [INFERRED]
  ui/src/App.tsx → ui/src/safearea.ts
- `App()` --calls--> `useHostTheme()`  [INFERRED]
  ui/src/App.tsx → ui/src/theme.ts

## Import Cycles
- None detected.

## Communities (17 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (18): //, compilerOptions, allowImportingTsExtensions, baseUrl, jsx, lib, module, moduleDetection (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (16): dependencies, hono, jose, @sentralbee/app-sdk, devDependencies, @types/bun, typescript, module (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, baseUrl, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit, skipLibCheck (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (13): devDependencies, @types/bun, typescript, name, private, scripts, build:ui, demo (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (31): dependencies, class-variance-authority, clsx, @fontsource-variable/inter, lucide-react, radix-ui, @radix-ui/react-label, @radix-ui/react-separator (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (6): Auth & env, Develop, Layout, ss-moniepoint-app, Stack, Status

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (49): cn(), api, AppConfig, j(), naira(), sessionToken(), Terminal, Unmapped (+41 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (17): MatchOutcome, reconcile(), getUnmapped(), listUnmapped(), markUnmappedResolved(), resolveWorkspace(), upsertUnmapped(), body (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (26): app, bearer(), PlatformClaims, sessionAuth, SessionVars, verifier(), verifyProvision(), verifySession() (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (24): _setPlatformKey(), H, makeTestKeys(), signProvision(), signSession(), TestKeys, DEFAULT_EVENTS, getMoniepointClient() (+16 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (19): formatMinor(), InstructionsPaymentIntent, reserve(), ReserveDeps, toIntent(), esc(), notFoundPage(), PayData (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (6): H, jj(), json(), mock, payload, sig

## Knowledge Gaps
- **145 isolated node(s):** `name`, `private`, `type`, `module`, `dev` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `Community 14` to `Community 8`, `Community 9`, `Community 15`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `cn()` (e.g. with `MoniepointMark()` and `StatusPill()`) actually correct?**
  _`cn()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._