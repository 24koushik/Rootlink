with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    for line in f:
        if 'OpenRouter API error' in line:
            print(repr(line))
