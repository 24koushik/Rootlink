import re

with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

old_retry = '''CRITICAL INSTRUCTION FOR RETRY:\\nThe previous output was too compressed or failed quality checks. \\n1. For SUMMARY: Re-read the COMPLETE source. Expand the explanation of the major concepts. Add the important supporting details and relationships present in the source. Create multiple meaningful sections where the source contains multiple conceptual areas. Do not pad with repetition.\\n2. For MIND MAP: Identify additional independent conceptual branches. Do not put unrelated concepts under one parent. Create a balanced hierarchy. \\nReturn ONLY the required JSON structure.'''

new_retry = '''CRITICAL INSTRUCTION FOR RETRY:\\nThe previous output was too compressed or failed quality checks. \\n1. For SUMMARY: Re-read the COMPLETE source. Expand the explanation of the major concepts. Add the important supporting details and relationships present in the source. Create multiple meaningful sections where the source contains multiple conceptual areas. Do not pad with repetition.\\n2. For MIND MAP: Restructure the information into independent conceptual branches. Do not represent the source as a linear outline. The root should represent the central subject. Group related concepts under separate major branches. Use sibling branches for concepts that are conceptually independent. Do not create artificial concepts. Do not duplicate concepts merely to increase branching. \\nReturn ONLY the required JSON structure.'''

code = code.replace(old_retry, new_retry)

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed retry prompt.")
