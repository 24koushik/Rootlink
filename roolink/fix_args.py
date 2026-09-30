with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'const finalValidation = validateMindMapQuality(generatedData.mindMap, content.split(/\s+/).length);',
    'const finalValidation = validateMindMapQuality(generatedData.mindMap, content.split(/\s+/).length, content.length);'
)

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed args.")
