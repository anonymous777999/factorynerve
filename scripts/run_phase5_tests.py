"""Run Phase 5 tests with environment setup, bypassing conftest server."""
import os
import sys
import shutil

# Must set env BEFORE any imports
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test"
os.environ["ANTHROPIC_API_KEY"] = "test"
os.environ["AI_PROVIDER"] = "groq"
os.environ["RATE_LIMIT_MAX_REQUESTS"] = "100000"
os.environ["LOG_LEVEL"] = "CRITICAL"
os.environ["DATA_ENCRYPTION_KEY"] = "dGhpcyBpcyBhIHRlc3Qga2V5IGZvciBlbmNyeXB0aW9u=="

# Bypass conftest
conftest = "tests/conftest.py"
conftest_bak = "tests/conftest.py.bak"
if os.path.exists(conftest) and not os.path.exists(conftest_bak):
    shutil.move(conftest, conftest_bak)
    print(f"Bypassed {conftest}")

import pytest

test_file = "tests/test_unstructured_document_detection.py"
if not os.path.exists(test_file):
    print(f"ERROR: {test_file} not found!")
    sys.exit(1)

exit_code = pytest.main([test_file, "-v", "--tb=short"])

# Restore conftest
if os.path.exists(conftest_bak):
    shutil.move(conftest_bak, conftest)
    print(f"Restored {conftest}")

sys.exit(exit_code)
