"""
Fix bare except: blocks in router files to preserve tracebacks.

Changes:
  except Exception:  →  except Exception as error:
  raise HTTPException(...)  →  raise HTTPException(...) from error

This preserves the original exception chain for Sentry/logging while
still returning the proper HTTP response to the client.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROUTER_DIR = ROOT / "backend" / "routers"

# Track all patterns: we need to match:
#   except Exception:
#       raise HTTPException(...)
# But NOT:
#   except Exception as error:
#   except Exception:  # pylint: disable=broad-except
#       logger.exception(...)
#       raise HTTPException(...)

# Simpler approach: find files with bare 'except Exception:' patterns
# and add 'as error:' + 'from error' to the subsequent raise

total_fixes = 0
total_files = 0

for py_file in sorted(ROUTER_DIR.glob("*.py")):
    content = py_file.read_text("utf-8")
    original = content
    
    # Pattern 1: except Exception: (no 'as') followed by raise HTTPException
    # Add 'as error:' to the except line, and ' from error' to the raise line
    lines = content.split('\n')
    new_lines = []
    i = 0
    fixes = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Check for bare 'except Exception:' (without 'as')
        if re.match(r'^except Exception:$', stripped):
            # Add 'as error'
            indent = line[:len(line) - len(line.lstrip())]
            new_lines.append(f"{indent}except Exception as error:")
            fixes += 1
            
            # Look ahead for the raise statement
            # It could be on the next line or a few lines down
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith('except ') and not lines[j].strip().startswith('else:') and not lines[j].strip().startswith('finally:'):
                # Check if this line has raise HTTPException but no 'from'
                raise_match = re.match(r'^(\s*)(raise HTTPException.*)([^)]\))', lines[j])
                if raise_match and 'from' not in lines[j]:
                    # Remove trailing comma/colon check
                    if 'from' not in lines[j]:
                        lines[j] = lines[j].rstrip()
                        if lines[j].endswith(')') or lines[j].endswith(','):
                            lines[j] = lines[j] + ' from error'
                        else:
                            lines[j] = lines[j] + ' from error'
                    fixes += 1
                elif 'raise HTTPException' in lines[j] and 'from' not in lines[j]:
                    lines[j] = lines[j].rstrip()
                    if not lines[j].endswith(' from error'):
                        lines[j] = lines[j] + ' from error'
                    fixes += 1
                j += 1
            
            if j > i + 1:
                # Add the lines after the except
                for k in range(i + 1, j):
                    new_lines.append(lines[k])
                i = j
                continue
        
        new_lines.append(line)
        i += 1
    
    content = '\n'.join(new_lines)
    
    if content != original:
        py_file.write_text(content, "utf-8")
        total_files += 1
        total_fixes += fixes
        print(f"  Fixed {fixes} pattern(s) in {py_file.name}")

print(f"\nTotal: {total_fixes} fixes across {total_files} files")
