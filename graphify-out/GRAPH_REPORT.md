# Graph Report - ss-moniepoint-app  (2026-07-06)

## Corpus Check
- 14 files · ~1,276 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 114 nodes · 102 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ee72a679`
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 13 edges
2. `compilerOptions` - 13 edges
3. `compilerOptions` - 12 edges
4. `scripts` - 5 edges
5. `scripts` - 5 edges
6. `scripts` - 5 edges
7. `ss-moniepoint-app` - 5 edges
8. `ready()` - 2 edges
9. `private` - 1 edges
10. `module` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (14 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (15): //, compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleDetection, moduleResolution (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (14): dependencies, hono, devDependencies, @types/bun, typescript, module, name, private (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit, skipLibCheck (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (12): devDependencies, @types/bun, typescript, name, private, scripts, build:ui, dev (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (12): dependencies, react, react-dom, devDependencies, @types/react, @types/react-dom, typescript, vite (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (5): Develop, Layout, ss-moniepoint-app, Stack, Status

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, typecheck

## Knowledge Gaps
- **83 isolated node(s):** `name`, `private`, `type`, `module`, `dev` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `name`, `private`, `type` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._