with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

replacement = """
    let sections = ss.sections || [];
    if (sections.length === 0 && ss.keyConcepts && ss.keyConcepts.length > 0) {
      sections = ss.keyConcepts.map((c: any) => ({
        title: c.concept,
        explanation: c.explanation,
        keyPoints: []
      }));
    }

    sections = sections.map((sec: any) => ({
      ...sec,
      keyPoints: sec.keyPoints || sec.points || []
    }));
"""

code = code.replace(
    '''    let sections = ss.sections || [];
    if (sections.length === 0 && ss.keyConcepts && ss.keyConcepts.length > 0) {
      sections = ss.keyConcepts.map((c: any) => ({
        title: c.concept,
        explanation: c.explanation,
        keyPoints: []
      }));
    }''',
    replacement
)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed normalization!")
