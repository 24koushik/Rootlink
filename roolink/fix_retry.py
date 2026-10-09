with open("src/app/api/nodes/retry/route.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("import { NextResponse } from 'next/server';", "import { NextResponse, after } from 'next/server';")
text = text.replace("// Background process\n    (async () => {", "// Background process\n    after(async () => {")
text = text.replace("""           node.processingStatus = 'failed';
           globalGraph.updateNode(node.id, node);
         }
       } catch (err) {
         node.processingStatus = 'failed';
         globalGraph.updateNode(node.id, node);
       }
    })();""", """           node.processingStatus = 'failed';
           globalGraph.updateNode(node.id, node);
         }
       } catch (err) {
         node.processingStatus = 'failed';
         globalGraph.updateNode(node.id, node);
       }
    });""")

with open("src/app/api/nodes/retry/route.ts", "w", encoding="utf-8") as f:
    f.write(text)
