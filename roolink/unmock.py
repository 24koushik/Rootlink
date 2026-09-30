with open('src/app/api/nodes/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'let structuredSummary = { title: title, overview: "Mock overview", sections: [{heading: "Java Basics", explanation: "Java is...", keyPoints: ["It is a language"]}], keyTakeaways: ["Java is good"] }; let mindMap, entities = [{name: "Java", type: "technology", context: "Java is a programming language"}], keyMoments;',
    'let structuredSummary, mindMap, entities, keyMoments;'
).replace(
    '/* if (isYouTube) {',
    'if (isYouTube) {'
).replace(
    'graphData = globalGraph.addScrapedDataToGraph(nodeTitle, entities); */',
    'graphData = globalGraph.addScrapedDataToGraph(nodeTitle, entities);'
)

with open('src/app/api/nodes/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)
