# Implementation Plan: Knowledge Graph Data Pipeline Rebuild

## Goal
To implement a robust Entity Resolution, Deduplication, and Normalization pipeline that transforms the Roolink app from a "bag of scraped pages" into a true, deterministic Knowledge Graph.

## User Review Required

> [!IMPORTANT]
> Currently, the "state" of the graph lives in the Next.js API memory (`globalGraph` in `lib/graph.ts`), while the frontend simply polls it. The prompt mentions integrating with Zustand or React state. Since the browser extension posts to the Next.js API, **I will implement the core deduplication and edge generation engines within the `lib/graph.ts` backend service**. This maintains your client/server architecture while fulfilling the deterministic data model requirements. The frontend will receive the perfectly normalized data array and simply pass it to the D3 renderer.

## Proposed Changes

### `src/lib/graph.ts` (Backend Store & Data Model)
- **Deterministic Data Model**:
  - `TrustNode`: Redefine with stable `id` (URL slug or normalized name), `canonicalName`, `type`, `sourceUrl`, `trustScore`, `mentionCount`, `firstSeen`, `lastSeen`, `verificationStatus`, and `sourceReferences`.
  - `TrustEdge`: Create a new interface for explicit edges: `id`, `sourceId`, `targetId`, `relationshipType`, `confidence`, `createdBy`, `createdAt`.
- **Deduplication Engine (`processIncomingEntities`)**:
  - Implement a pure function that takes extracted entities and merges them into the current state array.
  - Generates a deterministic ID (e.g., stripping noise like "- Wikipedia").
  - On match: updates `mentionCount`, recalculates `trustScore` using a weighted running average (`calculateAggregateTrust`), and appends `sourceReferences`.
- **Relationship Generation (`generateEdgesFromPage`)**:
  - Implement a pure function that connects the main page subject to child entities with distinct `relationshipType` and `confidence` parameters.
- **Store Methods**:
  - `addScrapedDataToGraph`: Main transaction handler replacing `addNode`. Processes the primary page entity, the child entities extracted by AI, merges them via the pure functions, and commits them atomically to the graph maps.

### `src/app/api/nodes/route.ts` (API Layer)
- Refactor the POST handler. When a page is scraped, it will call Gemini not just for a summary, but to explicitly **extract entities and their relationships** in a structured JSON schema.
- Feed this extracted structured payload into `globalGraph.addScrapedDataToGraph()`.

### `roolink-extension/content.js` & `background.js` (Extension Guardrails)
- Currently, the extension only sends the raw page content once.
- Update `content.js` to ensure that if multiple manual captures are triggered on the same page, or if future logic extracts keyword mentions iteratively, they are pre-grouped into a single payload array to prevent rapid-fire duplicate API requests.

### `src/app/page.tsx` (Frontend Integration)
- The React frontend already accepts `nodes` from the API. We will update the frontend to fetch `edges` as well (or infer them from the API response) and pass both to `GraphViz.tsx`.
- Add the `getUniqueNodesForDropdown()` derived state selector to defensively ensure the dropdowns remain strictly deduplicated.

## Verification Plan

### Unit Testing / Pure Functions
- I will create a test suite (or standalone test runner inside the project) specifically testing `processIncomingEntities` and `calculateAggregateTrust` with scenarios:
  1. Identical ID merge logic (mentionCount increments, trust updates).
  2. Fuzzy-matching noise reduction (e.g., "Dhurandhar" vs "Dhurandhar - Wikipedia").

### Manual Verification
- Capture the same page multiple times to verify no duplicate nodes spawn.
- Capture two pages referencing the same entity to verify the node's visual weight/mention count grows and a connecting edge is established.
- Ensure the dropdown menu has no duplicate entries.
