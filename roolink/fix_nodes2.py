with open('src/app/api/nodes/route.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

while lines[-1].strip() == '}':
    lines.pop()

lines.append('}\n')

with open('src/app/api/nodes/route.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)
