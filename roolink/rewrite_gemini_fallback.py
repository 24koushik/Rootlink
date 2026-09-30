with open('src/lib/gemini.ts', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Remove the fallback for extractGraphData
text = re.sub(
    r'if \(!parsedResult \|\| !parsedResult\.summary\) \{[\s\S]*?entities: \[\]\n    \};\n  \}',
    r'if (!parsedResult || !parsedResult.summary) { throw new Error("AI extraction failed."); }',
    text
)

# Remove the fallback for extractVideoGraphData
text = re.sub(
    r'if \(!parsedResult \|\| !parsedResult\.summary\) \{[\s\S]*?entities: \[\]\n    \};\n  \}',
    r'if (!parsedResult || !parsedResult.summary) { throw new Error("AI extraction failed."); }',
    text
)

with open('src/lib/gemini.ts', 'w', encoding='utf-8') as f:
    f.write(text)
