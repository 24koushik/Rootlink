with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

depth = 0
for i, line in enumerate(lines):
    for char in line:
        if char == '{': depth += 1
        elif char == '}': depth -= 1
    if depth < 0:
        print(f"Extra closing brace at line {i+1}")
        break

if depth > 0:
    print(f"Missing {depth} closing braces at end of file!")
elif depth == 0:
    print("Braces are balanced!")
