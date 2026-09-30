package com.roolink.model;

import java.util.UUID;

public class GraphEdge {
    private String id;
    private String sourceId;
    private String targetId;
    private String relationshipType;
    private long createdAt;

    public GraphEdge() {
        this.id = UUID.randomUUID().toString();
        this.createdAt = System.currentTimeMillis();
    }

    public GraphEdge(String sourceId, String targetId, String relationshipType) {
        this();
        this.sourceId = sourceId;
        this.targetId = targetId;
        this.relationshipType = relationshipType;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSourceId() { return sourceId; }
    public void setSourceId(String sourceId) { this.sourceId = sourceId; }

    public String getTargetId() { return targetId; }
    public void setTargetId(String targetId) { this.targetId = targetId; }

    public String getRelationshipType() { return relationshipType; }
    public void setRelationshipType(String relationshipType) { this.relationshipType = relationshipType; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
}
