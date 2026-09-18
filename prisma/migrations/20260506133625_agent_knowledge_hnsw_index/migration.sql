-- HNSW index on AgentKnowledgeChunk.embedding for fast cosine top-k retrieval.
-- Manually authored because Prisma cannot generate indexes on Unsupported types.
CREATE INDEX IF NOT EXISTS agent_knowledge_chunk_embedding_idx
  ON "AgentKnowledgeChunk"
  USING hnsw (embedding vector_cosine_ops);
