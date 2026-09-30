with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    for i, line in enumerate(lines):
        # 0-indexed: lines 563, 564, 565 are indices 562, 563, 564
        if i in [562, 563, 564]:
            continue
        f.write(line)

print("Removed extra lines.")
