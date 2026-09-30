import re

with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# I will just use string replace.
old_prompt_start = "    const baseSystemPrompt = `You are Rootlink's Knowledge Architecture Engine."

start_idx = code.find(old_prompt_start)
if start_idx == -1:
    print("Could not find baseSystemPrompt block!")
else:
    end_idx = code.find("}`;", start_idx)
    if end_idx == -1:
        print("Could not find end of baseSystemPrompt block!")
    else:
        end_idx += 3
        new_prompt = """    const baseSystemPrompt = `You are Rootlink's Knowledge Architecture Engine. Analyze the COMPLETE source content. Build a detailed hierarchical knowledge map of the source.

--- PART 1: DETAILED STUDY SUMMARY ---
Create a rich, structured summary with a detailed overview, multiple conceptual sections, and key takeaways.
Expand the explanation of major concepts. Do not compress the summary.

--- PART 2: HIERARCHICAL MIND MAP ---
The root must represent the single central topic of the source.
Under the root, identify the major independent concepts that explain the topic.

For a substantial source, create approximately 3-7 major conceptual branches when the source supports them.
Each major branch must represent a genuinely different concept, not a rewording of the root.
Each major branch should contain its own relevant sub-concepts when supported by the source.

Do NOT put the entire source under one generic branch.
Do NOT create a branch called 'Document Content', 'Overview', 'Details', or 'Information' unless that is genuinely a concept discussed by the source.
Do NOT create artificial branches merely to satisfy a number requirement.
Do NOT duplicate concepts.
Do NOT make the tree a linear outline.
Prefer semantic grouping over chronological copying of the source.

Your mental model for the hierarchy should be:
CENTRAL TOPIC
├── CONCEPT A
│   ├── SUB-CONCEPT
│   └── SUB-CONCEPT
├── CONCEPT B
│   ├── SUB-CONCEPT
│   └── SUB-CONCEPT
├── CONCEPT C
│   ├── SUB-CONCEPT
│   └── SUB-CONCEPT
└── CONCEPT D
    ├── SUB-CONCEPT
    └── SUB-CONCEPT

(This is just a structural instruction. The actual concepts must come from the source.)

Node titles MUST be short (2-8 words).
Node descriptions MUST be one short sentence (5-20 words). No paragraphs!

Return strict JSON matching this structure exactly:
{
  "summary": {
    "title": "Document Title",
    "overview": "Detailed overview of what the source is about",
    "sections": [
      {
        "heading": "Section Concept",
        "explanation": "Detailed explanation of this concept",
        "keyPoints": ["Point 1", "Point 2"]
      }
    ],
    "keyTakeaways": ["Takeaway 1", "Takeaway 2"]
  },
  "mindMap": {
    "root": {
      "id": "root",
      "title": "Central Topic",
      "description": "Short description",
      "children": [
        {
          "id": "node-1",
          "title": "Major Concept",
          "description": "Short description",
          "children": []
        }
      ]
    }
  }
}`;"""
        code = code[:start_idx] + new_prompt + code[end_idx:]
        with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
            f.write(code)
        print("Fixed baseSystemPrompt.")
