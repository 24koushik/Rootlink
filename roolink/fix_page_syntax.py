import re

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Find the double function body and fix it.
# The issue is there is a duplicate block.
bad_block = '''  let keyTakeaways = ss.keyTakeaways || ss.keyInsights || node.keyInsights || [];
  
  return {
    overview,
    sections,
    keyTakeaways
  };
}
  
  let keyTakeaways = ss.keyTakeaways || ss.keyInsights || node.keyInsights || [];
  
  return {
    overview,
    sections,
    keyTakeaways
  };
}'''

good_block = '''  let keyTakeaways = ss.keyTakeaways || ss.keyInsights || node.keyInsights || [];
  
  return {
    overview,
    sections,
    keyTakeaways
  };
}'''

code = code.replace(bad_block, good_block)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed syntax error!")
