package com.roolink.service;

import com.roolink.model.GraphEdge;
import com.roolink.model.GraphNode;
import com.roolink.model.GraphResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GraphService {

    private final Map<String, GraphNode> nodes = new HashMap<>();
    private final List<GraphEdge> edges = new ArrayList<>();

    public GraphResponse getGraphData() {
        return new GraphResponse(new ArrayList<>(nodes.values()), edges);
    }

    public GraphResponse addNode(GraphNode node) {
        nodes.put(node.getId(), node);
        return getGraphData();
    }

    public GraphResponse deleteNode(String id) {
        nodes.remove(id);
        edges.removeIf(edge -> edge.getSourceId().equals(id) || edge.getTargetId().equals(id));
        return getGraphData();
    }

    public GraphResponse linkNodes(String sourceId, String targetId) {
        boolean exists = edges.stream().anyMatch(e -> 
            (e.getSourceId().equals(sourceId) && e.getTargetId().equals(targetId)) ||
            (e.getSourceId().equals(targetId) && e.getTargetId().equals(sourceId))
        );

        if (!exists) {
            edges.add(new GraphEdge(sourceId, targetId, "manual"));
        }
        return getGraphData();
    }

    public GraphResponse unlinkNodes(String sourceId, String targetId) {
        edges.removeIf(e -> 
            e.getSourceId().equals(sourceId) && e.getTargetId().equals(targetId)
        );
        return getGraphData();
    }
}
