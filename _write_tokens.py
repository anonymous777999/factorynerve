import sys

def write_tokens():
    content = open(sys.argv[1], 'r').read() if len(sys.argv) > 1 else ''
    if not content:
        print('No content provided')
        return
    with open('web/src/styles/tokens.css', 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Wrote {len(content)} chars to tokens.css')

write_tokens()
