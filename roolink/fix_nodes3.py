with open('src/app/api/nodes/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

depth = 0
for char in code:
    if char == '{': depth += 1
    elif char == '}': depth -= 1

if depth > 0:
    code += '}' * depth

with open('src/app/api/nodes/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)
