import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find imports of useCollection or useDocument from hooks
    if not ('useCollection' in content or 'useDocument' in content):
        return

    # Replace the import
    new_content = content
    new_content = re.sub(r'\buseCollection\b', 'useLiveCollection', new_content)
    new_content = re.sub(r'\buseDocument\b', 'useLiveDocument', new_content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            if file != 'hooks.ts':
                fix_file(os.path.join(root, file))
