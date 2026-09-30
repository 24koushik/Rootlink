with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

depth = 0
for i, line in enumerate(lines):
    old_depth = depth
    for char in line:
        if char == '{': depth += 1
        elif char == '}': depth -= 1
    if i > 560:
        print(f"Line {i+1} [{old_depth} -> {depth}]: {line.strip()}")
