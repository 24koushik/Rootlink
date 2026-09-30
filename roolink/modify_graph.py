with open('src/lib/graph.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('export interface TrustNode {', '''export interface TrustNode {
  captureStatus?: 'idle' | 'capturing' | 'captured' | 'failed';
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';''')

with open('src/lib/graph.ts', 'w', encoding='utf-8') as f:
    f.write(text)
