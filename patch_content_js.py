import re

def main():
    try:
        with open('roolink-extension/content.js', 'r', encoding='utf-8') as f:
            content = f.read()

        animation_logic = """      isCapturing = true;
      if (autoCollapseTimeout) clearTimeout(autoCollapseTimeout);
      
      const captureMessages = [
        'CAPTURING',
        'EXTRACTING CONTENT',
        'ANALYZING',
        'BUILDING KNOWLEDGE',
        'GENERATING SUMMARY',
        'BUILDING MIND MAP'
      ];
      let msgIndex = 0;
      textContainer.innerText = captureMessages[0];
      const captureInterval = setInterval(() => {
        if (!isCapturing) {
          clearInterval(captureInterval);
          return;
        }
        msgIndex = Math.min(msgIndex + 1, captureMessages.length - 1);
        textContainer.innerText = captureMessages[msgIndex];
      }, 800);"""

        content = content.replace("      isCapturing = true;\n      if (autoCollapseTimeout) clearTimeout(autoCollapseTimeout);\n      \n      textContainer.innerText = 'Capturing...';", animation_logic)

        content = content.replace("toggleBtn.classList.add('roolink-success');\n          textContainer.innerHTML = `${checkIcon} Captured!`;", "toggleBtn.classList.add('roolink-success');\n          textContainer.innerHTML = `${checkIcon} COMPLETE`;")

        with open('roolink-extension/content.js', 'w', encoding='utf-8') as f:
            f.write(content)

        print("content.js patched successfully")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
