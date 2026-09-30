import re
with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(
    r'finalError = OpenRouter API error: \$\{res\.status\};',
    r'let eb = ""; try { eb = await res.text(); } catch(e) {} finalError = OpenRouter API error:  - ;',
    code
)

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Replaced!")
