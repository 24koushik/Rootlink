package com.roolink.controller;

import com.roolink.model.GraphResponse;
import com.roolink.service.GraphService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/link")
@CrossOrigin(origins = "http://localhost:3000")
public class LinkController {

    @Autowired
    private GraphService graphService;

    @PostMapping
    public ResponseEntity<GraphResponse> linkNodes(@RequestBody Map<String, String> body) {
        String sourceId = body.get("sourceId");
        String targetId = body.get("targetId");
        
        if (sourceId == null || targetId == null) {
            return ResponseEntity.badRequest().build();
        }
        
        return ResponseEntity.ok(graphService.linkNodes(sourceId, targetId));
    }

    @DeleteMapping
    public ResponseEntity<GraphResponse> unlinkNodes(@RequestBody Map<String, String> body) {
        String sourceId = body.get("sourceId");
        String targetId = body.get("targetId");
        
        if (sourceId == null || targetId == null) {
            return ResponseEntity.badRequest().build();
        }
        
        return ResponseEntity.ok(graphService.unlinkNodes(sourceId, targetId));
    }
}
