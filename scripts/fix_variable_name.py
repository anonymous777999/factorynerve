"""Rename _e to error in the try/except blocks for codebase consistency."""

PATH = "backend/routers/steel.py"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Replace _e with error in the new try/except blocks
# We only want to replace patterns like "except Exception as _e:" -> "except Exception as error:"
# and ", detail=f\"...: {_e}\") from _e" -> ", detail=f\"...: {error}\") from error"
content = content.replace("except Exception as _e:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create dispatch: {_e}\") from _e",
                          "except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create dispatch: {error}\") from error")
content = content.replace("except Exception as _e:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create payment: {_e}\") from _e",
                          "except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create payment: {error}\") from error")
content = content.replace("except Exception as _e:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create invoice: {_e}\") from _e",
                          "except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create invoice: {error}\") from error")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Done: renamed _e to error for codebase consistency")
