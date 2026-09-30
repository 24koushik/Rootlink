def patch_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    # Find where the node properties are updated
    old_update = """           createdNode.structuredSummary = res.structuredSummary;
           createdNode.mindMap = res.mindMap;
           createdNode.processingStatus = 'completed';"""
           
    new_update = """           createdNode.structuredSummary = res.structuredSummary;
           createdNode.mindMap = res.mindMap;
           if (res.semanticProfile) createdNode.semanticProfile = res.semanticProfile;
           createdNode.processingStatus = 'completed';"""

    text = text.replace(old_update, new_update)

    # In retry, node is updated
    old_retry_update = """           node.structuredSummary = res.structuredSummary;
           node.mindMap = res.mindMap;
           node.processingStatus = 'completed';"""
           
    new_retry_update = """           node.structuredSummary = res.structuredSummary;
           node.mindMap = res.mindMap;
           if (res.semanticProfile) node.semanticProfile = res.semanticProfile;
           node.processingStatus = 'completed';"""

    text = text.replace(old_retry_update, new_retry_update)

    # After addScrapedDataToGraph, add the semantic linking trigger
    trigger_old = "globalGraph.addScrapedDataToGraph(createdNode, extractedEntities);"
    trigger_new = """globalGraph.addScrapedDataToGraph(createdNode, extractedEntities);
           globalGraph.recalculateAutomaticLinks();"""
    text = text.replace(trigger_old, trigger_new)

    trigger_retry_old = "globalGraph.addScrapedDataToGraph(node, extractedEntities);"
    trigger_retry_new = """globalGraph.addScrapedDataToGraph(node, extractedEntities);
           globalGraph.recalculateAutomaticLinks();"""
    text = text.replace(trigger_retry_old, trigger_retry_new)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(text)

patch_file("src/app/api/nodes/route.ts")
patch_file("src/app/api/nodes/retry/route.ts")
