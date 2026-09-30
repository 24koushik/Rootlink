with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

lines = code.split('\n')
stack = []
for i, line in enumerate(lines):
    for char in line:
        if char == '{': stack.append(i+1)
        elif char == '}': 
            if stack: stack.pop()
            else: 
                print(f"Unmatched closing brace at line {i+1}")
                break

if stack:
    print(f"Unmatched opening braces at lines: {stack}")
