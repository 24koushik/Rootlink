def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
        
    text = text.replace('let res;', 'let res: any;')
    text = text.replace('n => n.id === nodeId', '(n: any) => n.id === nodeId')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

fix_file('src/app/api/nodes/route.ts')
fix_file('src/app/api/nodes/retry/route.ts')
