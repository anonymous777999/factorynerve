import json, time, sys, urllib.request, urllib.error, http.cookiejar
BASE="http://127.0.0.1:8765"; TS=int(time.time()); results=[]
def rec(status,name,detail=""):
    results.append((status,name,str(detail)[:300]))
    print("["+status+"] "+name+((" :: "+str(detail)) if detail else ""),flush=True)
class Client:
    def __init__(self):
        self.cj=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
    def csrf(self):
        for ck in self.cj:
            if ck.name=="dpr_csrf": return ck.value
        return None
    def req(self,method,path,body=None):
        url=BASE+path; data=None; headers={"Accept":"application/json"}
        if body is not None:
            data=json.dumps(body).encode(); headers["Content-Type"]="application/json"
        if method in ("POST","PUT","PATCH","DELETE"):
            t=self.csrf()
            if t: headers["X-CSRF-Token"]=t
        r=urllib.request.Request(url,data=data,headers=headers,method=method)
        try:
            resp=self.opener.open(r,timeout=30); code=resp.getcode(); payload=resp.read().decode()
        except urllib.error.HTTPError as e:
            code=e.code; payload=e.read().decode()
        except Exception as e:
            return None,0,str(e)
        try: j=json.loads(payload)
        except Exception: j=payload
        return j,code,None
c=Client()
email="e2e_owner_%d@example.com"%TS; password="E2ePass@123456"; factory="E2E Nerve Plant %d"%TS
reg,code,_=c.req("POST","/auth/register",{"name":"E2E Owner","email":email,"password":password,"factory_name":factory,"phone_number":"+919812345678"})
token=""
if code==201 and isinstance(reg,dict) and reg.get("success"):
    rec("PASS","01 register new org","email="+email)
    link=reg["data"].get("verification_link","") or ""
    if "token=" in link: token=link.split("token=")[1].split("&")[0]
else:
    rec("FAIL","01 register new org","code=%s %s"%(code,reg))
if token:
    v,code,_=c.req("POST","/auth/email/verify",{"token":token})
    ok=code==200 and isinstance(v,dict) and v.get("success")
    rec("PASS" if ok else "FAIL","02 verify email",v.get("data",{}).get("message","") if isinstance(v,dict) else code)
else:
    rec("FAIL","02 verify email","no token")
lg,code,_=c.req("POST","/auth/login",{"email":email,"password":password})
rec("PASS" if code==200 and isinstance(lg,dict) and lg.get("success") else "FAIL","03 login owner","code=%s"%code)
me,code,_=c.req("GET","/auth/me")
if code==200 and isinstance(me,dict) and me.get("success"):
    dd=me["data"]; perms=dd.get("permissions",{})
    ok=dd.get("role")=="owner" and dd.get("email")==email and perms.get("can_manage_users")
    rec("PASS" if ok else "WARN","04 auth/me identity+perms","role=%s factory=%s"%(dd.get("role"),dd.get("factory_name")))
else:
    rec("FAIL","04 auth/me","code=%s"%code)
fs,code,_=c.req("GET","/settings/factory")
rec("PASS" if code==200 else "FAIL","05 get factory settings","code=%s"%code)
up,code,_=c.req("PUT","/settings/factory",{"factory_name":factory,"address":"1 Industrial Rd","industry_type":"steel","target_morning":120,"target_evening":110,"target_night":90})
rec("PASS" if code==200 else "WARN","06 update factory settings","code=%s"%code)
dr,code,_=c.req("POST","/settings/defect-reasons",{"code":"E2E%d"%TS,"label":"E2E Surface Defect"})
reason_id=(dr.get("data") or {}).get("id") if isinstance(dr,dict) else None
rec("PASS" if reason_id else "WARN","07 create defect reason","id=%s code=%s"%(reason_id,code))
ul,code,_=c.req("GET","/settings/users")
rec("PASS" if code==200 else "FAIL","08 list users","code=%s"%code)
for role in ["supervisor","operator","accountant"]:
    iv,code,_=c.req("POST","/settings/users/invite",{"name":"E2E "+role.title(),"email":"e2e_%s_%d@example.com"%(role,TS),"role":role,"factory_name":factory})
    good=code in (200,201)
    rec("PASS" if good else "WARN","09 invite "+role,"code=%s"%code+("" if good else " "+str(iv)[:120]))
raw,code,_=c.req("POST","/steel/inventory/items",{"item_code":"E2E-RAW-%d"%TS,"name":"E2E Raw Coil","category":"raw_material","display_unit":"kg","current_rate_per_kg":60})
raw_id=((raw.get("data") or {}).get("item") or {}).get("id") if isinstance(raw,dict) else None
rec("PASS" if raw_id else "FAIL","10 create raw item","id=%s code=%s"%(raw_id,code))
fin,code,_=c.req("POST","/steel/inventory/items",{"item_code":"E2E-FIN-%d"%TS,"name":"E2E Finished Sheet","category":"finished_goods","display_unit":"kg","current_rate_per_kg":100})
fin_id=((fin.get("data") or {}).get("item") or {}).get("id") if isinstance(fin,dict) else None
rec("PASS" if fin_id else "FAIL","11 create finished item","id=%s code=%s"%(fin_id,code))
if raw_id:
    tx,code,_=c.req("POST","/steel/inventory/transactions",{"item_id":raw_id,"transaction_type":"inward","quantity_kg":5000,"notes":"E2E opening"})
    rec("PASS" if code in (200,201) else "FAIL","12 inventory inward txn","code=%s"%code)
stk,code,_=c.req("GET","/steel/inventory/stock")
rec("PASS" if code==200 else "FAIL","13 read inventory stock","code=%s"%code)
today=time.strftime("%Y-%m-%d")
entry,code,_=c.req("POST","/entries",{"date":today,"shift":"morning","units_target":120,"units_produced":112,"manpower_present":18,"manpower_absent":2,"downtime_minutes":20,"downtime_reason":"E2E calibration","department":"Rolling","quality_issues":True,"rejection_qty":3,"defect_reason_id":reason_id,"notes":"E2E entry"})
entry_id=(entry.get("data") or {}).get("id") if isinstance(entry,dict) else None
rec("PASS" if entry_id else "FAIL","14 create DPR entry","id=%s code=%s"%(entry_id,code)+("" if entry_id else " "+str(entry)[:150]))
batch_id=None
if raw_id and fin_id:
    b,code,_=c.req("POST","/steel/batches",{"production_date":today,"input_item_id":raw_id,"output_item_id":fin_id,"input_quantity_kg":1000,"expected_output_kg":950,"actual_output_kg":940,"scrap_qty_kg":40,"rejection_qty_kg":20,"notes":"E2E batch"})
    batch_id=((b.get("data") or {}).get("batch") or {}).get("id") if isinstance(b,dict) else None
    rec("PASS" if batch_id else "WARN","15 create steel batch","id=%s code=%s"%(batch_id,code)+("" if batch_id else " "+str(b)[:120]))
if entry_id:
    ap,code,_=c.req("POST","/entries/%s/approve"%entry_id)
    rec("PASS" if code==200 else "WARN","16 approve entry","code=%s"%code+("" if code==200 else " "+str(ap)[:120]))
pu,code,_=c.req("POST","/attendance/punch",{"action":"in","shift":"morning","note":"E2E"})
rec("PASS" if code in (200,201) else "WARN","17 attendance punch in","code=%s"%code+("" if code in (200,201) else " "+str(pu)[:120]))
at,code,_=c.req("GET","/attendance/me/today")
rec("PASS" if code==200 else "WARN","18 attendance today","code=%s"%code)
rv,code,_=c.req("GET","/attendance/review")
rec("PASS" if code==200 else "WARN","19 attendance review queue","code=%s"%code)
lvc,code,_=c.req("GET","/attendance/live")
rec("PASS" if code==200 else "WARN","20 attendance live","code=%s"%code)
for nm,p in [("21 ocr status","/ocr/status"),("22 ocr templates","/ocr/templates"),("23 ocr verifications","/ocr/verifications"),("24 ocr verif-summary","/ocr/verifications/summary")]:
    r,code,_=c.req("GET",p)
    rec("PASS" if code==200 else "WARN",nm,"code=%s"%code)
inv_id=None; line_id=None
if fin_id:
    inv,code,_=c.req("POST","/steel/invoices",{"invoice_date":today,"customer_name":"E2E Buyer Co","payment_terms_days":30,"lines":[{"item_id":fin_id,"weight_kg":500,"rate_per_kg":105,"description":"E2E sheet"}],"notes":"E2E invoice"})
    if isinstance(inv,dict) and code in (200,201):
        data=inv.get("data") or {}; invd=data.get("invoice") or data
        inv_id=invd.get("id"); lines=invd.get("lines") or []
        if inv_id and not lines:
            det,dc,_=c.req("GET","/steel/invoices/%s"%inv_id)
            dd=(det.get("data") or {}) if isinstance(det,dict) else {}
            lines=(dd.get("invoice") or dd).get("lines") or []
        line_id=lines[0].get("id") if lines else None
        rec("PASS" if inv_id else "WARN","25 create invoice","id=%s line=%s"%(inv_id,line_id))
    else:
        rec("WARN","25 create invoice","code=%s %s"%(code,str(inv)[:150]))
if inv_id and line_id:
    dsp,code,_=c.req("POST","/steel/dispatches",{"invoice_id":inv_id,"dispatch_date":today,"truck_number":"MH12AB1234","driver_name":"E2E Driver","driver_phone":"+919800000000","lines":[{"invoice_line_id":line_id,"weight_kg":500}],"notes":"E2E dispatch"})
    dspd=(dsp.get("data") or {}) if isinstance(dsp,dict) else {}
    dsp_id=(dspd.get("dispatch") or dspd).get("id")
    rec("PASS" if dsp_id else "WARN","26 create dispatch","id=%s code=%s"%(dsp_id,code)+("" if dsp_id else " "+str(dsp)[:120]))
for nm,p in [("weekly","/reports/weekly"),("monthly","/reports/monthly"),("insights","/reports/insights")]:
    r,code,_=c.req("GET",p)
    rec("PASS" if code==200 else "WARN","27 report "+nm,"code=%s"%code)
for nm,p in [("manager","/analytics/manager"),("weekly","/analytics/weekly"),("monthly","/analytics/monthly"),("trends","/analytics/trends")]:
    r,code,_=c.req("GET",p)
    rec("PASS" if code==200 else "WARN","28 analytics "+nm,"code=%s"%code)
n,code,_=c.req("GET","/notifications")
rec("PASS" if code==200 else "WARN","29 notifications list","code=%s"%code)
uc,code,_=c.req("GET","/notifications/unread-count")
rec("PASS" if code==200 else "WARN","30 unread-count","code=%s"%code)
ma,code,_=c.req("PATCH","/notifications/read-all")
rec("PASS" if code==200 else "WARN","31 mark-read-all","code=%s"%code)
c2=Client()
lg2,code,_=c2.req("POST","/auth/login",{"email":email,"password":password})
if code==200:
    rec("PASS","32 re-login fresh session","ok")
    el,code,_=c2.req("GET","/entries")
    arr=[]
    if code==200:
        items=el.get("data"); arr=items.get("items",items) if isinstance(items,dict) else items
    found=any(isinstance(x,dict) and x.get("id")==entry_id for x in (arr or []))
    rec("PASS" if found else "WARN","33 persistence entry survives","entry_id=%s found=%s"%(entry_id,found))
    il,code,_=c2.req("GET","/steel/inventory/items")
    idata=il.get("data") if isinstance(il,dict) else {}
    iarr=idata.get("items",idata) if isinstance(idata,dict) else idata
    ifound=any(isinstance(x,dict) and x.get("id")==raw_id for x in (iarr or []))
    rec("PASS" if ifound else "WARN","34 persistence item survives","raw_id=%s found=%s"%(raw_id,ifound))
else:
    rec("FAIL","32 re-login","code=%s"%code)
anon=Client()
pm,code,_=anon.req("GET","/settings/users")
rec("PASS" if code in (401,403) else "FAIL","35 RBAC anon blocked","code=%s"%code)
bad=Client(); bad.req("POST","/auth/login",{"email":email,"password":password})
req=urllib.request.Request(BASE+"/settings/defect-reasons",data=json.dumps({"code":"NOCSRF%d"%TS,"label":"nocsrf"}).encode(),headers={"Content-Type":"application/json"},method="POST")
try:
    bad.opener.open(req,timeout=15); ccode=200
except urllib.error.HTTPError as e:
    ccode=e.code
except Exception:
    ccode=-1
rec("PASS" if ccode in (401,403) else "WARN","36 CSRF POST w/o token rejected","code=%s"%ccode)
p=sum(1 for s,_,_ in results if s=="PASS")
f=sum(1 for s,_,_ in results if s=="FAIL")
w=sum(1 for s,_,_ in results if s=="WARN")
print("\n"+"="*60)
print("SUMMARY: %d PASS, %d WARN, %d FAIL (total %d)"%(p,w,f,len(results)))
print("="*60)
if f:
    print("\nFAILURES:")
    for s,nn,d in results:
        if s=="FAIL": print("  - %s: %s"%(nn,d))
if w:
    print("\nWARNINGS:")
    for s,nn,d in results:
        if s=="WARN": print("  - %s: %s"%(nn,d))
json.dump({"pass":p,"warn":w,"fail":f,"results":[{"status":s,"name":nn,"detail":d} for s,nn,d in results]},open(".e2e/results.json","w"),indent=2)
