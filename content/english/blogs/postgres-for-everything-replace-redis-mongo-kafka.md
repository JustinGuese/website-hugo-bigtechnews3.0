---
title: "Postgres for Everything: Why Teams Are Replacing Redis, Mongo, and Kafka With PostgreSQL"
date: "2026-11-14T11:00:00+00:00"
description: "Why modern engineering teams are ditching sprawling multi-database stacks for PostgreSQL. How to use JSONB, pgvector, SKIP LOCKED, and UNLOGGED tables, plus true architectural limits."
summary: "Running five different distributed datastores—PostgreSQL, Redis, MongoDB, Pinecone, and Kafka—imposes massive operational complexity, split-brain failure modes, and dual-write corruption. Learn how modern teams consolidate these workloads directly into PostgreSQL, with concrete SQL patterns and clear limits on when specialized engines are truly required."
categories:
  - DevOps
tags:
  - DevOps
  - PostgreSQL
  - Database Architecture
  - Redis
  - Kafka
  - pgvector
  - Backend Engineering
slug: postgres-for-everything-replace-redis-mongo-kafka
url: /blogs/postgres-for-everything-replace-redis-mongo-kafka/
draft: false
params:
  author: "BriefTechNews Database Systems Group"
  lang: en
---

In the early 2010s, "polyglot persistence" was the dominant dogma of software architecture. The prevailing wisdom dictated that you should never use a single database engine for multiple workloads:
- Use **PostgreSQL** for relational tables.
- Spin up **MongoDB** for flexible JSON documents.
- Deploy a **Redis** cluster for caching and session state.
- Stand up **RabbitMQ** or **Apache Kafka** for message queues and asynchronous events.
- Subscribe to a dedicated SaaS vector database (like **Pinecone** or **Milvus**) for AI semantic search.

By 2026, the industry has realized the brutal hangover of this architecture: **The Operational Tax of Distributed Sprawl**.

When you operate five distinct stateful systems, you must maintain five backup strategies, five Terraform modules, five disaster recovery runbooks, five monitoring clusters, and five IAM connection pools. Worse, you introduce the **dual-write problem**: when an API request updates Postgres and attempts to publish to Kafka or invalidate Redis, a network partition inevitably leaves your datastores permanently out of sync.

The modern response is simple: **Just use PostgreSQL for everything until your scale mathematically demands otherwise.**

Here is how modern production teams are consolidating document storage, vector search, background queues, and ephemeral caching directly into PostgreSQL—complete with production SQL implementations and the exact throughput ceilings where you must break out.

---

## The Consolidation Architecture: One Engine to Rule Them All

```
TRADITIONAL POLYGLOT PERSISTENCE (High Cognitive & Ops Load)
+-------------------------------------------------------------------------+
| [App Backend] ---> Dual-Write Disasters & Distributed Tracing Hell      |
|     |---> Postgres (Relational)                                         |
|     |---> Redis (Cache & Session)                                       |
|     |---> MongoDB (Unstructured Documents)                              |
|     |---> Kafka / RabbitMQ (Async Event Queue)                          |
|     |---> Pinecone (Vector Embeddings)                                  |
+-------------------------------------------------------------------------+

MODERN POSTGRESQL CONSOLIDATION (ACID Transactions & Zero Drift)
+-------------------------------------------------------------------------+
| [App Backend]                                                           |
|       |                                                                 |
|       v (Single Connection Pool, Single Backup, Single ACID Boundary)   |
| +---------------------------------------------------------------------+ |
| |                        POSTGRESQL 16 / 17                           | |
| |  * Tables: Relational Core                                          | |
| |  * JSONB + GIN: Document Storage (Replaces Mongo)                   | |
| |  * pgvector (HNSW): Semantic Search (Replaces Dedicated Vector DB)  | |
| |  * FOR UPDATE SKIP LOCKED: Work Queues (Replaces Celery / RabbitMQ)  | |
| |  * UNLOGGED Tables: Low-Latency Ephemeral Cache (Replaces Redis)    | |
| +---------------------------------------------------------------------+ |
+-------------------------------------------------------------------------+
```

---

## 1. Replacing MongoDB with JSONB & GIN Indexes

Early adopters chose MongoDB for schema flexibility and nested document models. Since PostgreSQL 9.4, and reinforced heavily in PostgreSQL 15+, PostgreSQL’s native `JSONB` data type stores decomposed binary JSON with complete indexing support.

### Production Pattern: Schema-Free Document Store with GIN
You can query nested keys, array elements, and even enforce structural schema constraints using generated columns or `pg_jsonschema`.

```sql
-- Create a document collection table
CREATE TABLE customer_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Fast containment queries with GIN indexing (path ops)
CREATE INDEX idx_customer_events_payload ON customer_events USING GIN (payload jsonb_path_ops);

-- Query nested attributes with sub-millisecond index scans
SELECT id, payload->>'user_id' AS user_id
FROM customer_events
WHERE payload @> '{"metadata": {"plan": "enterprise", "country": "US"}}';
```

**Why this beats Mongo:** You get atomic cross-table joins between your relational user accounts and your unstructured document events in a single transaction.

---

## 2. Replacing Dedicated Vector Databases with `pgvector`

With the explosion of GenAI, retrieval-augmented generation (RAG), and semantic search, dedicated vector databases raised hundreds of millions of dollars. But for 95% of engineering organizations, maintaining an external vector database creates massive data synchronization drift. When a user updates or deletes a document, you must coordinate deletions between your primary database and the vector store.

The open-source **`pgvector`** extension turns Postgres into a high-performance vector engine.

### Production Pattern: HNSW Indexing for Sub-10ms Vector Search

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_content TEXT NOT NULL,
    embedding VECTOR(1536) -- Standard OpenAI text-embedding-3-small dimension
);

-- Build a Hierarchical Navigable Small World (HNSW) index
CREATE INDEX idx_document_embeddings_hnsw 
ON document_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Perform cosine similarity search with relational filters
SELECT chunk_content, 
       1 - (embedding <=> '[0.012, -0.045, ...]'::vector) AS similarity
FROM document_embeddings
WHERE document_id IN (SELECT id FROM documents WHERE organization_id = 'org_123')
ORDER BY embedding <=> '[0.012, -0.045, ...]'::vector
LIMIT 5;
```

**Why this beats Pinecone:** ACID referential integrity. If an organization deletes an account or revokes document access, a standard foreign key `ON DELETE CASCADE` instantly removes the vector embeddings. You never leak stale enterprise data into LLM prompts.

---

## 3. Replacing Celery & RabbitMQ with `FOR UPDATE SKIP LOCKED`

Message queues are traditionally offloaded to Celery with Redis or RabbitMQ. But implementing transactional queuing in Postgres eliminates an entire class of dual-write race conditions (e.g., database commit succeeds, but queue push fails).

Using `SELECT ... FOR UPDATE SKIP LOCKED`, multiple background workers can pull jobs from a table concurrently without blocking each other and without race conditions.

### Production Pattern: The Bulletproof Postgres Job Queue

```sql
CREATE TABLE job_queue (
    id BIGSERIAL PRIMARY KEY,
    job_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX idx_job_queue_unprocessed 
ON job_queue (created_at) 
WHERE status = 'pending';
```

When worker processes fetch jobs, they atomically claim and lock the row:

```sql
-- Atomically claim the oldest 10 pending jobs
WITH claimed AS (
    SELECT id
    FROM job_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 10
    FOR UPDATE SKIP LOCKED
)
UPDATE job_queue
SET status = 'processing',
    locked_until = clock_timestamp() + INTERVAL '5 minutes',
    attempts = attempts + 1
WHERE id IN (SELECT id FROM claimed)
RETURNING *;
```

If a worker crashes, the `locked_until` timestamp expires, allowing a watchdog query to reset the job status back to `pending`.

**Why this beats Celery/RabbitMQ:** Your business operation and your job creation happen inside the **same database transaction**. No message is ever enqueued if the checkout transaction rolls back!

---

## 4. Replacing Basic Redis with `UNLOGGED` Tables

Need a fast key-value cache or ephemeral session store, but don't want to run a Redis cluster or manage Sentinel failover?

PostgreSQL provides **`UNLOGGED` tables**. These tables bypass the Write-Ahead Log (WAL), eliminating disk sync latency on writes. While they are not durable across an abrupt database crash (they are automatically truncated on recovery), they provide blisteringly fast in-memory key-value operations with standard SQL semantics.

### Production Pattern: High-Throughput Session Cache

```sql
CREATE UNLOGGED TABLE app_sessions (
    session_id VARCHAR(128) PRIMARY KEY,
    user_id UUID NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_app_sessions_expiry ON app_sessions (expires_at);

-- Upsert session state in sub-millisecond response time
INSERT INTO app_sessions (session_id, user_id, data, expires_at)
VALUES ('sess_abc123', 'user_456', '{"theme": "dark", "ip": "1.2.3.4"}', NOW() + INTERVAL '24 hours')
ON CONFLICT (session_id) 
DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at;
```

With `shared_buffers` properly tuned (typically 25% of system RAM), reads and writes execute directly against Linux memory pages.

---

## Performance Comparison: Postgres vs. Specialized Engines

| Workload | PostgreSQL Feature | Dedicated Alternative | Latency Difference | Operational Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **Document Store** | JSONB + GIN Index | MongoDB | Within 5% of Mongo | Massive reduction |
| **Semantic Search** | `pgvector` (HNSW) | Pinecone / Qdrant | Sub-10ms (up to 10M vectors) | Zero dual-write drift |
| **Job Queue** | `SKIP LOCKED` | RabbitMQ / Celery | Handles 2,000–5,000 jobs/sec | Atomic ACID transactions |
| **Session Cache** | `UNLOGGED` Tables | Redis | 0.8ms (PG) vs 0.2ms (Redis) | Eliminates Redis cluster ops |

---

## The True Limits: When You MUST Break Out

We are SREs and systems engineers, not dogmatists. While PostgreSQL can handle 90% of use cases, there are hard physical thresholds where specialized distributed datastores become non-negotiable:

### 1. High-Volume Streaming Event Ingestion (> 50,000 writes/sec)
If you are ingesting IoT telemetry, real-time ad tracking, or financial clickstreams exceeding 50,000 messages per second, PostgreSQL WAL write amplification and MVCC table bloat (vacuuming dead tuples) will saturate your I/O subsystem. This is the domain of **Apache Kafka**, **Redpanda**, or **ClickHouse**.

### 2. Microsecond-Level Memory Caching (> 100,000 QPS)
If your application serves a global user base requiring sub-millisecond p99 response times (e.g., distributed rate limiting, real-time gaming leaderboards, or transient session locks), **Redis** running pure in-memory single-threaded execution will beat Postgres `UNLOGGED` tables.

### 3. Billion-Scale Vector Embeddings (> 20M vectors)
While `pgvector` scales comfortably to several million 1536-dimensional vectors with an HNSW index, maintaining indexes for tens of millions of vectors requires hundreds of gigabytes of RAM dedicated purely to index graphs. At that hyper-scale, dedicated vector engines with disk-quantized vector indices (like Qdrant or Milvus) are mathematically superior.

---

## Conclusion: Start Lean, Consolidate First

The most common failure in modern backend architecture is premature optimization. Engineering teams spend weeks setting up Terraform modules for Redis, Kafka, and MongoDB before they have validated product-market fit or seen their first 1,000 concurrent users.

Before you add another distributed system to your cloud bill and on-call rotation, ask: **Can PostgreSQL do this?**

In 2026, the answer is almost always yes.
