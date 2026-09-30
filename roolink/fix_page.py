import re

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the extra dangling characters
bad_dangling = '''                        {canonicalSummary.keyTakeaways.map((insight: string, idx: number) => (
                          <li key={idx}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{insight}</ReactMarkdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                          </li>
                        ))}
                      </ul>'''

good_dangling = '''                        {canonicalSummary.keyTakeaways.map((insight: string, idx: number) => (
                          <li key={idx}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{insight}</ReactMarkdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}'''

code = code.replace(bad_dangling, good_dangling)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed dangling brackets.")
