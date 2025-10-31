# Feature Roadmap

This document tracks potential future enhancements for mcp-memory-sqlite based on user feedback and LLM evaluation.

**Current Status:** v0.0.4 - Text search with relevance ranking (8.5/10 rating from LLM evaluation)

## Recently Completed ✅

### v0.0.4 - Vector Search Removal & Text Search Optimization
- ✅ Removed non-functional vector search code
- ✅ Added relevance-based search ranking (name > type > observation)
- ✅ Added result limiting (default 10, max 50)
- ✅ Added `get_entity_with_relations` for graph exploration
- ✅ Optimized for LLM context efficiency (~12KB saved per entity)
- ✅ Comprehensive documentation update

**Impact:** Tool rated 8.5/10 by LLM evaluation, with 5/5 search quality rating.

## High Priority 🔥

### Bulk Operations
**Status:** Proposed
**Priority:** High
**Effort:** Small

Add batch entity/relationship creation for efficiency:

```typescript
// Current: Must create entities one array at a time
create_entities({ entities: [...] })
create_relations({ relations: [...] })

// Proposed: Single transaction for large imports
bulk_import({
  entities: [...],  // Hundreds of entities
  relations: [...], // Hundreds of relations
})
```

**Use case:** Importing existing knowledge bases, initializing project context

**Benefits:**
- Faster imports (single transaction)
- Atomic operations (all or nothing)
- Better for large-scale setup

---

### Relationship Metadata
**Status:** Proposed
**Priority:** Medium
**Effort:** Small

Add optional descriptions/properties to relations:

```typescript
interface Relation {
  from: string;
  to: string;
  relationType: string;
  metadata?: {
    description?: string;
    strength?: number;      // 0.0-1.0 confidence/importance
    created_at?: string;
    tags?: string[];
  };
}
```

**Use case:** Richer context for relationships, temporal tracking

**Benefits:**
- More informative graph exploration
- Track when/why relationships were created
- Priority/importance for decision-making

---

## Medium Priority 📊

### Complex Query Support
**Status:** Proposed
**Priority:** Medium
**Effort:** Large

Add query language for complex searches:

```typescript
// Examples:
search_advanced({
  filters: {
    entityType: "person",
    hasRelation: { type: "works_on", target: "TaskFlow" },
    observations: { contains: "frontend" }
  },
  limit: 10
})

// Or find paths between entities:
find_path({
  from: "Alice",
  to: "PostgreSQL",
  maxDepth: 3
})
```

**Use case:** Advanced knowledge graph queries, relationship discovery

**Benefits:**
- More powerful searches
- Relationship inference
- Complex decision support

**Challenges:**
- Query language design
- Performance optimization
- Increased API complexity

---

### Entity Versioning
**Status:** Proposed
**Priority:** Medium
**Effort:** Large

Track entity changes over time:

```typescript
interface EntityVersion {
  entity: Entity;
  version: number;
  modified_at: string;
  changes: {
    added_observations?: string[];
    removed_observations?: string[];
  };
}

// API:
get_entity_history(name: string): EntityVersion[]
restore_entity_version(name: string, version: number)
```

**Use case:** Audit trail, undo changes, temporal analysis

**Benefits:**
- Change tracking
- Rollback capability
- Understanding evolution

**Challenges:**
- Storage overhead
- Migration complexity
- UI/API design

---

## Low Priority 💡

### Entity Merging
**Status:** Proposed
**Priority:** Low
**Effort:** Medium

Handle duplicate/similar entities:

```typescript
merge_entities({
  primary: "PostgreSQL",
  duplicates: ["postgres", "PostgresDB"],
  strategy: "keep_all_observations"  // or "primary_only"
})
```

**Use case:** Deduplication, data cleanup

**Benefits:**
- Cleaner knowledge graph
- Better search results
- Easier maintenance

---

### Namespace/Project Separation
**Status:** Proposed
**Priority:** Low
**Effort:** Large

Support multiple isolated knowledge graphs:

```typescript
// Current: Single global graph
create_entities({ entities: [...] })

// Proposed: Project-scoped graphs
create_entities({
  namespace: "project_taskflow",
  entities: [...]
})

search_nodes({
  namespace: "project_taskflow",  // or "all"
  query: "frontend"
})
```

**Use case:** Multiple projects, context isolation

**Benefits:**
- Prevents cross-project pollution
- Clearer boundaries
- Better organization

**Challenges:**
- Significant schema changes
- Migration complexity
- API design impact

---

### Export/Import
**Status:** Proposed
**Priority:** Low
**Effort:** Small

Export and import knowledge graphs:

```typescript
export_graph({
  format: "json",  // or "graphml", "cypher"
  namespace?: "project_taskflow"
}): string

import_graph({
  format: "json",
  data: string,
  merge_strategy: "replace" | "merge"
})
```

**Use case:** Backup, sharing, migration

**Benefits:**
- Portability
- Backup/restore
- Sharing knowledge bases

---

## Won't Do ❌

### Vector/Semantic Search
**Status:** Rejected
**Reason:** Non-functional in practice, wastes context window

Vector search was removed in v0.0.4 because:
- LLMs cannot generate embeddings
- 12KB context waste per entity
- Text search with relevance ranking achieves similar results
- Adds unnecessary complexity

**Alternative:** Continue improving text search (fuzzy matching, relevance ranking, synonyms)

---

### AI-Powered Features
**Status:** Not Planned
**Reason:** Out of scope

Features like auto-relationship detection, entity extraction from text, or auto-summarization are:
- Better handled by the LLM using the tool
- Outside the scope of a memory tool
- Would require external API dependencies

**Alternative:** Let the LLM handle intelligence, tool handles storage

---

## Contributing

These features are suggestions based on user feedback. If you'd like to implement any:

1. **Open an issue** to discuss the approach
2. **Check for acceptance** before starting large changes
3. **Submit a PR** with tests and documentation

**Priority Guidelines:**
- High priority: Core functionality improvements, clear user value
- Medium priority: Nice-to-have features with good use cases
- Low priority: Edge cases or complex features with limited benefit

---

## Evaluation Criteria

New features should meet these standards:

✅ **User value:** Solves a real LLM memory problem
✅ **Context efficient:** Doesn't bloat LLM context window
✅ **Simple API:** Easy for LLMs to use correctly
✅ **Well tested:** Includes tests and documentation
✅ **Maintainable:** Doesn't add significant complexity

---

**Last updated:** Based on v0.0.4 LLM evaluation (8.5/10 rating)

**Feedback welcome:** [Open an issue](https://github.com/spences10/mcp-memory-sqlite/issues) with feature suggestions or use case descriptions.
