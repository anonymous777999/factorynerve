import os, uuid
from pathlib import Path
os.environ["DATABASE_URL"] = f"sqlite:///{Path('.').resolve().as_posix()}/vf_{uuid.uuid4().hex[:6]}.db"
for k,v in {"GROQ_API_KEY":"test","ANTHROPIC_API_KEY":"test","GEMINI_API_KEY":"test","AI_PROVIDER":"groq","JWT_SECRET_KEY":"x","APP_NAME":"DPR.ai","RAZORPAY_KEY_ID":"rzp_test_key","RAZORPAY_KEY_SECRET":"s","FRONTEND_URL":"http://x","EMAIL_VERIFICATION_EXPOSE_LINK":"1","RATE_LIMIT_MAX_REQUESTS":"100000","AUTH_RATE_LIMIT_MAX_ATTEMPTS":"100000"}.items():
    os.environ.setdefault(k,v)
from cryptography.fernet import Fernet
os.environ.setdefault("DATA_ENCRYPTION_KEY", Fernet.generate_key().decode())
import sys; sys.path.insert(0,".")
import backend.middleware.idempotency as idem
idem.IDEMPOTENCY_PRUNING_SAMPLE_RATE = -1
from backend.database import init_db, SessionLocal
init_db()
from starlette.testclient import TestClient
from backend.main import app
from tests.utils import register_user, set_org_plan_for_user_email
from backend.models.user import User
from backend.models.factory import Factory
from datetime import date
c=TestClient(app, raise_server_exceptions=False)
owner=register_user(c, role="admin", email="vf_"+uuid.uuid4().hex[:6]+"@ex.com")
db=SessionLocal()
u=db.query(User).filter(User.email==owner["email"]).first(); u.role="owner"
fac=db.query(Factory).filter(Factory.org_id==u.org_id).first(); fac.industry_type="steel"; fid=fac.factory_id
db.commit(); db.close()
set_org_plan_for_user_email(owner["email"],"factory")
OWN={"auth_session":owner["session_token"]}
R=[]
def s(label, resp):
    code=resp.status_code; ok=code<400
    R.append((label,code,ok)); print(("OK " if ok else "XX ")+label+" "+str(code)+" "+resp.text[:80])
    return resp
# FIX-04 notifications
s("notifications.list", c.get("/notifications", cookies=OWN))
s("notifications.unread-count", c.get("/notifications/unread-count", cookies=OWN))
# FIX-06 factories list normal
s("settings.factories", c.get("/settings/factories", cookies=OWN))
# FIX-01 invoice + FIX-02 dispatch (full chain)
cid=c.post("/steel/customers", json={"name":"B","phone":"9990001111","credit_limit":900000,"payment_terms_days":30}, cookies=OWN).json()["customer"]["id"]
iid=c.post("/steel/inventory/items", json={"item_code":"VF1","name":"TMT","category":"finished_goods","display_unit":"kg","current_rate_per_kg":55.0}, cookies=OWN).json()["item"]["id"]
c.post("/steel/inventory/transactions", json={"item_id":iid,"transaction_type":"inward","quantity_kg":5000,"notes":"x"}, cookies=OWN)
inv=s("steel.invoice.create", c.post("/steel/invoices", json={"invoice_date":date.today().isoformat(),"customer_id":cid,"customer_name":"B","lines":[{"item_id":iid,"weight_kg":500,"rate_per_kg":55}]}, cookies=OWN))
invj=inv.json().get("invoice",{}); lid=(invj.get("lines") or [{}])[0].get("id")
s("steel.dispatch.create", c.post("/steel/dispatches", json={"invoice_id":invj.get("id"),"dispatch_date":date.today().isoformat(),"truck_number":"MH1AA1","driver_name":"Driver","status":"dispatched","lines":[{"invoice_line_id":lid,"weight_kg":500}]}, cookies=OWN))
# FIX-03 anomaly + FIX-05 owner/decision dashboards
s("steel.anomalies", c.get("/steel/anomalies?days=30", cookies=OWN))
s("steel.owner.dashboard", c.get("/steel/owner/dashboard", cookies=OWN))
s("steel.decision.dashboard", c.get("/steel/decision/dashboard", cookies=OWN))
s("steel.owner-daily-pdf", c.get("/steel/owner-daily-pdf?report_date="+date.today().isoformat(), cookies=OWN))
# FIX-06 drift: force inconsistent template then list must not 500
db=SessionLocal()
f2=db.query(Factory).filter(Factory.factory_id==fid).first(); f2.workflow_template_key="general-ops-pack"; db.commit(); db.close()
s("settings.factories.DRIFTED", c.get("/settings/factories", cookies=OWN))
print("\nPASS", sum(1 for _,_,o in R if o), "/", len(R))
for l,co,o in R:
    if not o: print("  FAIL", l, co)
from backend.services.steel_intelligence import build_anomaly_detection
db=SessionLocal()
try:
    build_anomaly_detection(db, fid, days=30)
    print("ANOMALY OK")
except Exception:
    import traceback; traceback.print_exc()
db.close()
from backend.services.decision_intelligence import build_decision_dashboard
db=SessionLocal()
try:
    f3=db.query(Factory).filter(Factory.factory_id==fid).first()
    build_decision_dashboard(db, f3)
    print("DECISION OK")
except Exception:
    import traceback; traceback.print_exc()
db.close()
