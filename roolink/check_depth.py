with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

depth = 0
for i, line in enumerate(lines):
    for char in line:
        if char == '{': depth += 1
        elif char == '}': depth -= 1
    if depth == 0 and i > 250:
        print(f"Depth hits 0 at line {i+1}: {line.strip()}")
