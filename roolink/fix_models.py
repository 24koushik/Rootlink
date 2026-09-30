with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'const modelsToTry = [primaryModel, ...backupModels];',
    'const modelsToTry = [primaryModel, ...backupModels].slice(0, 3);'
)

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)
