package com.roolink.model;

import java.util.List;
import java.util.Map;

public class GraphNode {
    private String id;
    private String type; // e.g. "youtube", "article", "entity"
    private String canonicalName;
    private String url;
    private long captureTimestamp;
    
    private Map<String, Object> data; 
    // Contains title, aiSummary, keyInsights, sections, formulas, etc.

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getCanonicalName() { return canonicalName; }
    public void setCanonicalName(String canonicalName) { this.canonicalName = canonicalName; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public long getCaptureTimestamp() { return captureTimestamp; }
    public void setCaptureTimestamp(long captureTimestamp) { this.captureTimestamp = captureTimestamp; }

    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}
