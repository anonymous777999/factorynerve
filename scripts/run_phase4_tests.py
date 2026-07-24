"""Run Phase 4 tests with environment setup, bypassing conftest server."""
import os
import sys
import shutil

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test"
os.environ["ANTHROPIC_API_KEY"] = "test"
os.environ["AI_PROVIDER"] = "groq"
os.environ["RATE_LIMIT_MAX_REQUESTS"] = "100000"
os.environ["LOG_LEVEL"] = "CRITICAL"
os.environ["DATA_ENCRYPTION_KEY"] = "dGhpcyBpcyBhIHRlc3Qga2V5IGZvciBlbmNyeXB0aW9u=="

# Ensure backend module is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

conftest = "tests/conftest.py"
conftest_bak = "tests/conftest.py.bak"
if os.path.exists(conftest) and not os.path.exists(conftest_bak):
    shutil.move(conftest, conftest_bak)

import pytest
exit_code = pytest.main(["tests/test_ocr_validation_pipeline.py", "-v", "--tb=short"])

if os.path.exists(conftest_bak):
    shutil.move(conftest_bak, conftest)
sys.exit(exit_code)
