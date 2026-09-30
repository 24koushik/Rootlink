with open("src/lib/gemini.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(" || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY", "")

with open("src/lib/gemini.ts", "w", encoding="utf-8") as f:
    f.write(text)
