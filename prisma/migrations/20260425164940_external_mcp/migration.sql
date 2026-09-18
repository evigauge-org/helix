-- CreateTable
CREATE TABLE "agent_external_mcp_server" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "transport" TEXT NOT NULL DEFAULT 'streamable_http',
    "authJson" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastConnectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_external_mcp_server_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_external_mcp_server_agentId_idx" ON "agent_external_mcp_server"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_external_mcp_server_agentId_name_key" ON "agent_external_mcp_server"("agentId", "name");

-- AddForeignKey
ALTER TABLE "agent_external_mcp_server" ADD CONSTRAINT "agent_external_mcp_server_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
