with open('src/app/api/nodes/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# I will find out where the brace went missing.
# Let's count braces.
code = code.replace('\xff\xfe', '').replace('\x00', '').strip()
if code.endswith('}'):
    # remove trailing invalid chars
    pass
with open('src/app/api/nodes/route.ts', 'w', encoding='utf-8') as f:
    f.write(code + '\n}\n')
