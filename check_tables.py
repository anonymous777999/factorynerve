
import sqlite3
conn = sqlite3.connect('dpr_ai.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in c.fetchall()]
print('Tables:', tables)
print('auth_user present:', 'auth_user' in tables)
conn.close()
