package com.roolink.controller;

import com.roolink.model.GraphNode;
import com.roolink.model.GraphResponse;
import com.roolink.service.GraphService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/nodes")
@CrossOrigin(origins = "http://localhost:3000")
public class NodeController {

    @Autowired
    private GraphService graphService;

    @GetMapping
    public ResponseEntity<GraphResponse> getNodes() {
        return ResponseEntity.ok(graphService.getGraphData());
    }

    @PostMapping
    public ResponseEntity<GraphResponse> addNode(@RequestBody Map<String, Object> payload) {
        // Simplified dummy implementation for presentation purposes
        // In reality, this would call GeminiService to process text
        GraphNode node = new GraphNode();
        node.setId(UUID.randomUUID().toString());
        node.setCanonicalName(payload.getOrDefault("url", "New Node").toString());
        node.setType("webpage");
        node.setCaptureTimestamp(System.currentTimeMillis());
        node.setData(payload);
        
        return ResponseEntity.ok(graphService.addNode(node));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<GraphResponse> deleteNode(@PathVariable String id) {
        return ResponseEntity.ok(graphService.deleteNode(id));
    }
}
