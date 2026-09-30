with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'console.log([KNOWLEDGE] Returning finalError: );',
    'console.log(\'[KNOWLEDGE] Returning finalError: \' + finalError);'
)

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed log.")
