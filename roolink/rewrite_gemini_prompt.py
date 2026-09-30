import re

with open("src/lib/gemini.ts", "r", encoding="utf-8") as f:
    text = f.read()

old_schema = """  "mindMap": {
    "root": {"""

new_schema = """  "semanticProfile": {
    "concepts": ["High level concept 1", "Concept 2 (max 8)"],
    "keywords": ["specific keyword 1", "keyword 2 (max 8)"],
    "topics": ["broad topic 1", "topic 2 (max 3)"]
  },
  "mindMap": {
    "root": {"""

text = text.replace(old_schema, new_schema)

with open("src/lib/gemini.ts", "w", encoding="utf-8") as f:
    f.write(text)
