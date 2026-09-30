with open('src/lib/gemini.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix Groq model name
code = code.replace(
    "model: 'llama-3.1-8b-instant',",
    "model: 'llama3-8b-8192',"
)

# Fix local summary overview text to actually include the summary text
code = code.replace(
    "overview: 'Local summary',",
    "overview: 'Automated Local Extraction: ' + (localSum.length > 0 ? localSum.substring(0, 500) + '...' : 'No content could be extracted from this URL.'),"
)

with open('src/lib/gemini.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed gemini fallback issues.")
