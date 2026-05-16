import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")

db_url = os.environ.get("DATABASE_URL")
email = "supportvortexgptdev@gmail.com"

engine = create_engine(db_url)
with engine.connect() as conn:
    result = conn.execute(
        text("UPDATE users SET is_platform_admin = true WHERE email = :email"),
        {"email": email}
    )
    conn.commit()
    if result.rowcount > 0:
        print("Done. Platform admin granted to", email)
    else:
        print("User not found.")