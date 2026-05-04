from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import boto3

# ==============================
# INIT
# ==============================
app = FastAPI()
client = boto3.client("bedrock-runtime", region_name="eu-north-1")
MODEL_ID = "arn:aws:bedrock:eu-north-1:409448829111:inference-profile/eu.anthropic.claude-sonnet-4-6"

# ==============================
# SCHEMA (for Swagger UI)
# ==============================
class ChatRequest(BaseModel):
    prompt: str

# ==============================
# CORE FUNCTION
# ==============================
def call_claude(prompt: str):
    response = client.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}]
            }
        ],
        inferenceConfig={"maxTokens": 1000}
    )
    return response["output"]["message"]["content"][0]["text"]

# ==============================
# HEALTH CHECK
# ==============================
@app.get("/")
def home():
    return {"status": "Claude proxy is running"}

# ==============================
# SIMPLE ROUTE (Swagger testing)
# ==============================
@app.post("/chat")
async def simple_chat(data: ChatRequest):
    try:
        output_text = call_claude(data.prompt)
        return {
            "choices": [
                {
                    "message": {
                        "content": output_text
                    }
                }
            ]
        }
    except Exception as e:
        print("ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# OPENAI COMPATIBLE ROUTE (VS Code)
# ==============================
@app.post("/v1/chat/completions")
async def openai_chat(request: Request):
    try:
        body = await request.body()
        if not body:
            raise HTTPException(status_code=400, detail="Empty request")

        data = await request.json()
        messages = data.get("messages", [])

        if not messages:
            raise HTTPException(status_code=400, detail="No messages provided")

        user_message = messages[-1].get("content", "")

        if not user_message:
            raise HTTPException(status_code=400, detail="Empty message")

        output_text = call_claude(user_message)

        return {
            "id": "chatcmpl-bedrock",
            "object": "chat.completion",
            "model": "claude-sonnet",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": output_text
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print("ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))