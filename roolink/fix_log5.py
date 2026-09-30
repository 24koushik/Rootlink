with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'finalError = `OpenRouter API error: ${res.status}`;',
    'let eb = ""; try { eb = await res.text(); } catch(e) {} finalError = `OpenRouter API error: ${res.status} - ` + eb;'
)

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Replaced!")
