"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type AppLanguage = "en" | "hi" | "mr";

type I18nContextValue = {
  language: AppLanguage;
  locale: string;
  setLanguage: (next: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
  tp: (text: string) => string;
};

const LANGUAGE_STORAGE_KEY = "dpr:web:language";
const DEFAULT_LANGUAGE: AppLanguage = "en";
const VALID_LANGUAGES: AppLanguage[] = ["en", "hi", "mr"];
const LANGUAGE_SERVER_SNAPSHOT: AppLanguage = DEFAULT_LANGUAGE;
const MOJIBAKE_PATTERN = /(à¤|à¥|Ã|Â|â€|ðŸ)/;
const LANGUAGE_LOCALE_MAP: Record<AppLanguage, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;
const NORMALIZED_SPACE_PATTERN = /\s+/g;
const WORD_PATTERN = /([A-Za-z][A-Za-z'&/-]*)/g;

const TRANSLATIONS: Record<Exclude<AppLanguage, "en">, Record<string, string>> = {
  hi: {
    "language.label": "भाषा",
    "language.english": "English",
    "language.hindi": "हिन्दी",
    "language.marathi": "मराठी",
    "common.plan": "प्लान",
    "common.not_selected": "चयन नहीं किया गया",
    "shell.factory_context": "फैक्टरी संदर्भ",
    "shell.switch_factory": "फैक्टरी बदलें",
    "shell.switching_factory_context": "फैक्टरी संदर्भ बदला जा रहा है...",
    "shell.accessible_factories": "उपलब्ध फैक्ट्रियाँ",
    "shell.account_access": "अकाउंट एक्सेस",
    "shell.login": "लॉगिन",
    "shell.logout": "लॉगआउट",
    "shell.logging_out": "लॉगआउट हो रहा है...",
    "shell.switch_account": "अकाउंट बदलें",
    "shell.switching": "बदल रहा है...",
    "shell.language_hint": "यह सभी टैब में तुरंत लागू होगा",
    "shell.pinned": "पिन किए गए",
    "shell.quick": "क्विक",
    "nav.section.today": "आज",
    "nav.section.operations": "ऑपरेशन्स",
    "nav.section.review": "रिव्यू",
    "nav.section.management": "प्रबंधन",
    "nav.section.admin": "एडमिन",
    "nav.section.account": "अकाउंट",
    "nav.work_queue.label": "वर्क क्यू",
    "nav.work_queue.description": "दैनिक काम, रिव्यू लोड और अलर्ट के लिए एकीकृत क्यू",
    "nav.attendance.label": "अटेंडेंस",
    "nav.attendance.description": "पंच इन/आउट करें और लाइव अटेंडेंस ट्रैक रखें",
    "nav.today_board.label": "टुडे बोर्ड",
    "nav.today_board.description": "आज की प्राथमिकताएँ और अलर्ट एक ही जगह",
    "nav.my_day.label": "मेरा दिन",
    "nav.my_day.description": "शिफ्ट के असाइन किए गए काम और हैंडऑफ",
    "nav.shift_entry.label": "शिफ्ट एंट्री",
    "nav.shift_entry.description": "शिफ्ट उत्पादन डेटा जल्दी दर्ज करें",
    "nav.document_desk.label": "डॉक्यूमेंट डेस्क",
    "nav.document_desk.description": "पेपर रिकॉर्ड जल्दी से डिजिटल वर्कफ़्लो में लाएँ",
    "nav.steel_operations.label": "स्टील ऑपरेशन्स",
    "nav.steel_operations.description": "स्टॉक, उत्पादन, डिस्पैच और लॉस कंट्रोल",
    "nav.steel_charts.label": "स्टील चार्ट्स",
    "nav.steel_charts.description": "स्टॉक, उत्पादन, डिस्पैच और रेवेन्यू का चार्ट-फर्स्ट बोर्ड",
    "nav.customers.label": "कस्टमर्स",
    "nav.customers.description": "ग्राहक लेजर, भुगतान और बकाया ट्रैक करें",
    "nav.sales_invoices.label": "सेल्स इनवॉइस",
    "nav.sales_invoices.description": "वजन आधारित इनवॉइस और राजस्व नियंत्रण",
    "nav.dispatch.label": "डिस्पैच",
    "nav.dispatch.description": "गेट पास, ट्रक मूवमेंट और फॉलो-थ्रू",
    "nav.attendance_review.label": "अटेंडेंस रिव्यू",
    "nav.attendance_review.description": "मिस्ड पंच और नियमितीकरण केस बंद करें",
    "nav.review_queue.label": "रिव्यू क्यू",
    "nav.review_queue.description": "लंबित अनुमोदन और सत्यापन एक जगह",
    "nav.review_documents.label": "डॉक्यूमेंट रिव्यू",
    "nav.review_documents.description": "OCR पंक्तियों को अनुमोदन से पहले जांचें",
    "nav.stock_review.label": "स्टॉक रिव्यू",
    "nav.stock_review.description": "फिजिकल काउंट और मिसमैच निर्णयों की समीक्षा",
    "nav.attendance_reports.label": "अटेंडेंस रिपोर्ट्स",
    "nav.attendance_reports.description": "मैनपावर और लेट सिग्नल रिपोर्ट",
    "nav.reports_exports.label": "रिपोर्ट्स और एक्सपोर्ट्स",
    "nav.reports_exports.description": "आउटपुट, एक्सपोर्ट और ऑपरेटिंग सिग्नल",
    "nav.performance.label": "परफॉर्मेंस",
    "nav.performance.description": "ट्रेंड, तुलना और प्रदर्शन विश्लेषण",
    "nav.owner_desk.label": "ओनर डेस्क",
    "nav.owner_desk.description": "रिस्क और परफॉर्मेंस का हाई-लेवल व्यू",
    "nav.factory_network.label": "फैक्टरी नेटवर्क",
    "nav.factory_network.description": "फैक्ट्रियों की तुलना करें और संदर्भ बदलें",
    "nav.scheduled_updates.label": "शेड्यूल्ड अपडेट्स",
    "nav.scheduled_updates.description": "मैनेजर और ओनर के लिए ऑटो सारांश",
    "nav.ai_insights.label": "AI इनसाइट्स",
    "nav.ai_insights.description": "अनॉमली, सुझाव और KPI प्रश्न",
    "nav.attendance_admin.label": "अटेंडेंस एडमिन",
    "nav.attendance_admin.description": "कर्मचारी, शिफ्ट नियम और सेटअप",
    "nav.factory_admin.label": "फैक्टरी एडमिन",
    "nav.factory_admin.description": "फैक्ट्रियाँ, यूज़र, टेम्पलेट और नियंत्रण",
    "nav.subscription.label": "सब्सक्रिप्शन",
    "nav.subscription.description": "टियर और ऐड-ऑन की समीक्षा करें",
    "nav.billing.label": "बिलिंग और इनवॉइस",
    "nav.billing.description": "चेकआउट, इनवॉइस और सब्सक्रिप्शन प्रबंधन",
    "nav.profile.label": "प्रोफाइल",
    "nav.profile.description": "पहचान, एक्सेस और अकाउंट सेटिंग्स",
    "common.and": "और",
    "common.open": "खोलें",
    "nav.section.steel": "स्टील",
    "nav.section.insights": "इनसाइट्स",
    "dashboard.section.operations_board": "ऑपरेशंस बोर्ड",
    "dashboard.section.now": "अभी",
    "dashboard.section.attention": "ध्यान",
    "dashboard.section.quick_actions": "त्वरित क्रियाएं",
    "dashboard.section.advanced": "एडवांस्ड इनसाइट्स और बिज़नेस संदर्भ",
    "dashboard.header.operator_ready": "शिफ्ट के लिए तैयार",
    "dashboard.header.supervisor_ready": "टीम कंट्रोल लाइव है",
    "dashboard.header.owner_ready": "ओनर रिव्यू तैयार है",
    "dashboard.header.default": "आपको देखकर अच्छा लगा",
    "dashboard.header.there": "दोस्त",
    "dashboard.copy.operator": "शिफ्ट एंट्री जल्दी खोलें, समस्या जल्दी पकड़ें, और नेटवर्क कमजोर होने पर भी काम जारी रखें।",
    "dashboard.copy.supervisor": "पेंडिंग काम देखें, अनुमोदन जल्दी साफ करें, और स्टॉक व दस्तावेज़ संकेतों से आगे रहें।",
    "dashboard.copy.owner": "प्रॉफिट, लॉस, स्टॉक भरोसा और डिस्पैच जोखिम एक ही बोर्ड से ट्रैक करें।",
    "dashboard.copy.default": "इस बोर्ड को दैनिक काम, अनुमोदन और बिज़नेस रिव्यू के बीच सुरक्षित जंप-पॉइंट की तरह उपयोग करें।",
    "dashboard.action.open_reports": "रिपोर्ट खोलें",
    "dashboard.action.refresh_board": "बोर्ड रिफ्रेश करें",
    "dashboard.action.refreshing": "रिफ्रेश हो रहा है...",
    "dashboard.action.sync_queue": "क्यू सिंक करें",
    "dashboard.action.sync_now": "अभी सिंक करें",
    "dashboard.action.open_alert_feed": "अलर्ट फ़ीड खोलें",
    "dashboard.action.open_review_queue": "रिव्यू क्यू खोलें",
    "dashboard.action.scan_docs": "दस्तावेज़ स्कैन करें",
    "dashboard.action.steel_hub": "स्टील हब",
    "dashboard.action.open_steel_control": "स्टील कंट्रोल खोलें",
    "dashboard.action.open_reconciliations": "रिकंसिलिएशन खोलें",
    "dashboard.action.open_today_entry": "आज की एंट्री खोलें",
    "dashboard.action.open_7day_report": "7 दिन की रिपोर्ट खोलें",
    "dashboard.action.open_monthly_review": "मासिक रिव्यू खोलें",
    "dashboard.action.open_my_tasks": "मेरे कार्य खोलें",
    "dashboard.action.open_entry_form": "एंट्री फ़ॉर्म खोलें",
    "dashboard.action.view_plans": "प्लान देखें",
    "dashboard.action.open_billing": "बिलिंग खोलें",
    "dashboard.action.open_ai": "AI इनसाइट्स खोलें",
    "dashboard.action.open_login": "लॉगिन खोलें",
    "dashboard.action.register": "रजिस्टर",
    "dashboard.action.open_control_tower": "कंट्रोल टॉवर खोलें",
    "dashboard.action.open_analysis": "विश्लेषण खोलें",
    "dashboard.action.open_board": "बोर्ड खोलें",
    "dashboard.action.mark_read": "पढ़ा हुआ चिह्नित करें",
    "dashboard.metric.alerts": "अलर्ट",
    "dashboard.metric.signals": "सिग्नल",
    "dashboard.metric.pending_shift": "लंबित शिफ्ट",
    "dashboard.metric.today_entries": "आज की एंट्री",
    "dashboard.metric.pending_shifts_today": "आज लंबित शिफ्ट",
    "dashboard.metric.weekly_avg": "साप्ताहिक औसत प्रदर्शन",
    "dashboard.metric.recent_units": "हालिया यूनिट्स",
    "dashboard.metric.offline_queue": "ऑफलाइन क्यू",
    "dashboard.quick.title": "कम खोजें, सीधे काम करें",
    "dashboard.attention.title": "अभी क्या रिव्यू करना है",
    "dashboard.network.live": "नेटवर्क चालू है। क्रियाएं रियल टाइम में सिंक होंगी।",
    "dashboard.network.offline": "ऑफलाइन मोड सक्रिय है। एंट्री लोकली सेव होगी और बाद में सिंक होगी।",
    "dashboard.primary.fallback_title": "अगला कार्य शुरू करें",
    "dashboard.primary.fallback_detail": "अगले सर्वश्रेष्ठ कार्य से फ्लोर चलते रखें।",
    "dashboard.unread_alerts": "अनरीड अलर्ट",
    "dashboard.active": "सक्रिय",
    "dashboard.recent_entries": "हालिया एंट्री",
    "dashboard.recent_activity": "नवीनतम उत्पादन गतिविधि",
    "dashboard.entries.empty": "अभी तक कोई एंट्री सबमिट नहीं हुई।",
    "dashboard.alert.none": "अभी कोई अनरीड अलर्ट नहीं है।",
    "dashboard.ai.title": "AI असामान्यता रडार",
    "dashboard.ai.subtitle": "फैक्टरी ड्रिफ्ट प्रीव्यू",
    "dashboard.ai.empty": "अभी कोई असामान्यता प्रीव्यू उपलब्ध नहीं है।",
    "dashboard.ai.no_signals": "वर्तमान प्रीव्यू विंडो में कोई असामान्यता सिग्नल सक्रिय नहीं है।",
    "dashboard.top_signals": "टॉप सिग्नल",
    "dashboard.attention.now": "अभी किस पर ध्यान देना है",
    "dashboard.plan_limits.title": "प्लान और लिमिट्स",
    "dashboard.current_period": "वर्तमान अवधि",
    "dashboard.usage_summary": "उपयोग सारांश",
    "dashboard.requests": "रिक्वेस्ट",
    "dashboard.credits": "क्रेडिट",
    "dashboard.unlimited": "असीमित",
    "table.date": "तारीख",
    "table.shift": "शिफ्ट",
    "table.department": "विभाग",
    "table.units": "यूनिट्स",
    "table.downtime": "डाउनटाइम",
    "table.submitted": "सबमिट",
    "table.action": "क्रिया",
    "table.min": "मिनट",
    "dashboard.session.missing": "कोई सक्रिय सेशन नहीं मिला। लॉगिन स्क्रीन पर जाएं।",
    "dashboard.factory.active": "सक्रिय फैक्टरी",
    "dashboard.factory.general": "सामान्य विनिर्माण",
    "dashboard.organization.title": "संगठन",
    "dashboard.organization.current": "वर्तमान संगठन",
    "dashboard.control_tower.title": "कंट्रोल टॉवर",
    "dashboard.production_trend": "उत्पादन रुझान",
    "dashboard.last_7_days": "पिछले 7 दिन",
    "dashboard.window": "विंडो",
    "dashboard.mode": "मोड",
    "dashboard.preview": "प्रीव्यू",
    "dashboard.steel.section": "स्टील कंट्रोल",
    "dashboard.steel.title": "स्टील कंट्रोल अब अलग मॉड्यूल है",
    "dashboard.offline.detail": "इस ब्राउज़र से सिंक होने वाली एंट्री।",
    "dashboard.units.recent": "हालिया यूनिट्स",
    "dashboard.alerts.unread": "अनरीड अलर्ट",
    "dashboard.metric.recent_units_detail_prefix": "हाल की",
    "dashboard.metric.recent_units_detail_suffix": "एंट्री का रोलिंग टोटल।",
    "dashboard.analytics.last_7_days": "पिछले 7 उत्पादन दिनों पर आधारित।",
    "dashboard.analytics.upgrade": "एनालिटिक्स के लिए फैक्टरी प्लान में अपग्रेड करें।",
    "dashboard.analytics.empty": "अभी साप्ताहिक एनालिटिक्स डेटा नहीं है।",
    "dashboard.card.eyebrow.start_work": "काम शुरू करें",
    "dashboard.card.eyebrow.capture": "कैप्चर",
    "dashboard.card.eyebrow.stay_ahead": "आगे रहें",
    "dashboard.card.eyebrow.review": "रिव्यू",
    "dashboard.card.eyebrow.control": "कंट्रोल",
    "dashboard.card.eyebrow.escalate": "एस्केलेट",
    "dashboard.card.eyebrow.grow": "विकास",
    "dashboard.card.operator.title": "अगली शिफ्ट एंट्री पूरी करें",
    "dashboard.card.operator.action": "शिफ्ट एंट्री खोलें",
    "dashboard.card.capture.title": "पेपर रिकॉर्ड जल्दी लाएं",
    "dashboard.card.capture.action": "डॉक्यूमेंट कैप्चर खोलें",
    "dashboard.card.alerts.title": "आज के प्लांट सिग्नल देखें",
    "dashboard.card.alerts.action": "अलर्ट रिव्यू करें",
    "dashboard.card.supervisor.approval_title": "अनुमोदन क्यू साफ करें",
    "dashboard.card.supervisor.approval_action": "अनुमोदन इनबॉक्स खोलें",
    "dashboard.card.supervisor.stock_title": "स्टॉक भरोसा और मिसमैच जांचें",
    "dashboard.card.supervisor.escalate_title": "स्टील ऑपरेशन चलते रखें",
    "dashboard.card.business.title": "बिज़नेस रिव्यू लेयर खोलें",
    "dashboard.card.business.control_title": "लंबित निर्णय एक जगह देखें",
    "dashboard.card.business.control_detail_review": "सुपरवाइजरी काम अब एक इनबॉक्स में समूहित है।",
    "dashboard.card.business.grow_title": "ऑपरेशंस और कंपनी कंट्रोल के बीच जाएं",
    "dashboard.sync.starting": "ऑफलाइन क्यू सिंक हो रही है और डुप्लिकेट शिफ्ट जांची जा रही हैं...",
    "dashboard.sync.synced": "सिंक किया",
    "dashboard.sync.resolved": "सुलझाया",
    "dashboard.sync.duplicate_conflicts": "डुप्लिकेट कॉन्फ्लिक्ट",
    "dashboard.sync.still_waiting": "अभी भी लंबित",
    "dashboard.sync.update_prefix": "ऑफलाइन क्यू अपडेट",
    "dashboard.sync.none_ready": "कोई क्यू आइटम सिंक के लिए तैयार नहीं था।",
    "dashboard.sync.failed": "ऑफलाइन सिंक असफल रही।",
    "dashboard.sync.syncing": "सिंक हो रहा है...",
    "dashboard.alert.mark_read_failed": "अलर्ट को पढ़ा हुआ चिह्नित नहीं किया जा सका।",
    "attendance.title": "दैनिक उपस्थिति और पंच नियंत्रण",
    "attendance.session.login_required": "उपस्थिति खोलने के लिए कृपया लॉगिन करें।",
    "attendance.action.open_shift_entry": "शिफ्ट एंट्री खोलें",
    "attendance.action.live_board": "लाइव बोर्ड",
    "attendance.action.review_queue": "रिव्यू क्यू",
    "attendance.action.refresh": "उपस्थिति रिफ्रेश करें",
    "attendance.action.refresh_short": "रिफ्रेश",
    "attendance.action.punch_in": "पंच इन",
    "attendance.action.punch_out": "पंच आउट",
    "attendance.action.recording": "रिकॉर्ड हो रहा है...",
    "attendance.action.closing": "बंद किया जा रहा है...",
    "attendance.status.punch_in_recorded": "उपस्थिति पंच-इन रिकॉर्ड हो गया।",
    "attendance.status.punch_out_recorded": "उपस्थिति पंच-आउट रिकॉर्ड हो गया।",
    "attendance.status.updating": "उपस्थिति अपडेट हो रही है...",
    "attendance.status.updated": "अपडेट",
    "attendance.status.live_updates": "हर 25 सेकंड में लाइव अपडेट",
    "attendance.status.refreshing_background": "बैकग्राउंड में उपस्थिति डेटा रिफ्रेश हो रहा है...",
    "attendance.error.update_failed": "उपस्थिति अपडेट नहीं हो सकी।",
    "attendance.metric.date": "उपस्थिति तिथि",
    "attendance.metric.worked_time": "कार्य समय",
    "attendance.metric.overtime": "ओवरटाइम",
    "attendance.metric.factory_code": "फैक्टरी कोड",
    "attendance.metric.role": "भूमिका",
    "attendance.self_service.title": "सक्रिय शिफ्ट के लिए पंच नियंत्रण",
    "attendance.night_shift_note": "रात की शिफ्ट में पंच-आउट आधी रात के बाद भी उपलब्ध रहता है ताकि शिफ्ट सुरक्षित रूप से बंद की जा सके।",
    "attendance.tag.active_shift": "सक्रिय शिफ्ट",
    "attendance.tag.closed_today": "आज के लिए बंद",
    "attendance.tag.action_needed": "कार्रवाई आवश्यक",
    "role.operator": "ऑपरेटर",
    "role.attendance": "अटेंडेंस वर्कर",
    "role.supervisor": "सुपरवाइज़र",
    "role.accountant": "अकाउंटेंट",
    "role.manager": "मैनेजर",
    "role.admin": "एडमिन",
    "role.owner": "ओनर",
    "role.team_member": "टीम सदस्य",
  },
  mr: {
    "language.label": "भाषा",
    "language.english": "English",
    "language.hindi": "हिन्दी",
    "language.marathi": "मराठी",
    "common.plan": "प्लॅन",
    "common.not_selected": "निवडलेले नाही",
    "shell.factory_context": "फॅक्टरी संदर्भ",
    "shell.switch_factory": "फॅक्टरी बदला",
    "shell.switching_factory_context": "फॅक्टरी संदर्भ बदलत आहे...",
    "shell.accessible_factories": "उपलब्ध फॅक्टऱ्या",
    "shell.account_access": "अकाउंट प्रवेश",
    "shell.login": "लॉगिन",
    "shell.logout": "लॉगआउट",
    "shell.logging_out": "लॉगआउट होत आहे...",
    "shell.switch_account": "अकाउंट बदला",
    "shell.switching": "बदलत आहे...",
    "shell.language_hint": "हे सर्व टॅबमध्ये त्वरित लागू होईल",
    "shell.pinned": "पिन केलेले",
    "shell.quick": "क्विक",
    "nav.section.today": "आज",
    "nav.section.operations": "ऑपरेशन्स",
    "nav.section.review": "रिव्यू",
    "nav.section.management": "व्यवस्थापन",
    "nav.section.admin": "अॅडमिन",
    "nav.section.account": "अकाउंट",
    "nav.work_queue.label": "वर्क क्यू",
    "nav.work_queue.description": "दैनिक काम, रिव्यू लोड आणि अलर्टसाठी एकत्रित क्यू",
    "nav.attendance.label": "उपस्थिती",
    "nav.attendance.description": "पंच इन/आउट करा आणि लाईव्ह उपस्थिती पहा",
    "nav.today_board.label": "टुडे बोर्ड",
    "nav.today_board.description": "आजचे प्राधान्य आणि अलर्ट एकाच ठिकाणी",
    "nav.my_day.label": "माझा दिवस",
    "nav.my_day.description": "शिफ्टमधील असाइन काम आणि हँडऑफ",
    "nav.shift_entry.label": "शिफ्ट एंट्री",
    "nav.shift_entry.description": "शिफ्ट उत्पादन डेटा पटकन नोंदवा",
    "nav.document_desk.label": "डॉक्युमेंट डेस्क",
    "nav.document_desk.description": "पेपर रेकॉर्ड्स पटकन डिजिटलमध्ये आणा",
    "nav.steel_operations.label": "स्टील ऑपरेशन्स",
    "nav.steel_operations.description": "स्टॉक, उत्पादन, डिस्पॅच आणि लॉस कंट्रोल",
    "nav.steel_charts.label": "स्टील चार्ट्स",
    "nav.steel_charts.description": "स्टॉक, उत्पादन, डिस्पॅच आणि महसूल यांचा चार्ट-फर्स्ट बोर्ड",
    "nav.customers.label": "ग्राहक",
    "nav.customers.description": "ग्राहक लेजर, पेमेंट आणि बाकी ट्रॅक करा",
    "nav.sales_invoices.label": "सेल्स इनव्हॉइस",
    "nav.sales_invoices.description": "वजन-आधारित इनव्हॉइस आणि महसूल नियंत्रण",
    "nav.dispatch.label": "डिस्पॅच",
    "nav.dispatch.description": "गेट पास, ट्रक हालचाल आणि फॉलो-थ्रू",
    "nav.attendance_review.label": "उपस्थिती रिव्यू",
    "nav.attendance_review.description": "मिस्ड पंच आणि रेग्युलरायझेशन प्रकरणे बंद करा",
    "nav.review_queue.label": "रिव्यू क्यू",
    "nav.review_queue.description": "प्रलंबित मंजुरी आणि पडताळणी एकत्र",
    "nav.review_documents.label": "डॉक्युमेंट रिव्यू",
    "nav.review_documents.description": "OCR ओळी मंजुरीपूर्वी तपासा",
    "nav.stock_review.label": "स्टॉक रिव्यू",
    "nav.stock_review.description": "फिजिकल काउंट आणि मिसमॅच निर्णय तपासा",
    "nav.attendance_reports.label": "उपस्थिती अहवाल",
    "nav.attendance_reports.description": "मॅनपॉवर आणि लेट सिग्नल रिपोर्ट",
    "nav.reports_exports.label": "रिपोर्ट्स आणि एक्सपोर्ट्स",
    "nav.reports_exports.description": "आउटपुट, एक्सपोर्ट आणि ऑपरेशन सिग्नल",
    "nav.performance.label": "परफॉर्मन्स",
    "nav.performance.description": "ट्रेंड, तुलना आणि परफॉर्मन्स विश्लेषण",
    "nav.owner_desk.label": "ओनर डेस्क",
    "nav.owner_desk.description": "रिस्क आणि परफॉर्मन्सचे उच्च-स्तरीय दृश्य",
    "nav.factory_network.label": "फॅक्टरी नेटवर्क",
    "nav.factory_network.description": "फॅक्टऱ्यांची तुलना करा आणि संदर्भ बदला",
    "nav.scheduled_updates.label": "शेड्यूल्ड अपडेट्स",
    "nav.scheduled_updates.description": "मॅनेजर आणि ओनरसाठी ऑटो सारांश",
    "nav.ai_insights.label": "AI इनसाइट्स",
    "nav.ai_insights.description": "अनॉमली, सूचना आणि KPI प्रश्न",
    "nav.attendance_admin.label": "उपस्थिती अॅडमिन",
    "nav.attendance_admin.description": "कर्मचारी, शिफ्ट नियम आणि सेटअप",
    "nav.factory_admin.label": "फॅक्टरी अॅडमिन",
    "nav.factory_admin.description": "फॅक्टऱ्या, युजर्स, टेम्पलेट आणि नियंत्रण",
    "nav.subscription.label": "सब्सक्रिप्शन",
    "nav.subscription.description": "टियर आणि अॅड-ऑन पाहा",
    "nav.billing.label": "बिलिंग आणि इनव्हॉइस",
    "nav.billing.description": "चेकआउट, इनव्हॉइस आणि सब्सक्रिप्शन व्यवस्थापन",
    "nav.profile.label": "प्रोफाइल",
    "nav.profile.description": "ओळख, प्रवेश आणि अकाउंट सेटिंग्ज",
    "common.and": "आणि",
    "common.open": "उघडा",
    "nav.section.steel": "स्टील",
    "nav.section.insights": "इनसाइट्स",
    "dashboard.section.operations_board": "ऑपरेशन्स बोर्ड",
    "dashboard.section.now": "आता",
    "dashboard.section.attention": "लक्ष",
    "dashboard.section.quick_actions": "क्विक अ‍ॅक्शन्स",
    "dashboard.section.advanced": "प्रगत इनसाइट्स आणि व्यवसाय संदर्भ",
    "dashboard.header.operator_ready": "शिफ्टसाठी तयार",
    "dashboard.header.supervisor_ready": "टीम कंट्रोल सुरू आहे",
    "dashboard.header.owner_ready": "ओनर रिव्ह्यू तयार आहे",
    "dashboard.header.default": "तुम्हाला पुन्हा पाहून आनंद झाला",
    "dashboard.header.there": "मित्रा",
    "dashboard.copy.operator": "शिफ्ट एंट्री पटकन उघडा, समस्या लवकर पकडा, आणि नेटवर्क कमी असतानाही काम सुरू ठेवा.",
    "dashboard.copy.supervisor": "प्रलंबित काम पाहा, मंजुरी लवकर पूर्ण करा, आणि स्टॉक व दस्तऐवज सिग्नलवर नियंत्रण ठेवा.",
    "dashboard.copy.owner": "नफा, तोटा, स्टॉक विश्वास आणि डिस्पॅच रिस्क एकाच बोर्डवर ट्रॅक करा.",
    "dashboard.copy.default": "हा बोर्ड दैनिक काम, मंजुरी आणि व्यवसाय रिव्ह्यूसाठी सुरक्षित जंप-पॉइंट म्हणून वापरा.",
    "dashboard.action.open_reports": "रिपोर्ट उघडा",
    "dashboard.action.refresh_board": "बोर्ड रीफ्रेश करा",
    "dashboard.action.refreshing": "रीफ्रेश होत आहे...",
    "dashboard.action.sync_queue": "क्यू सिंक करा",
    "dashboard.action.sync_now": "आत्ता सिंक करा",
    "dashboard.action.open_alert_feed": "अलर्ट फीड उघडा",
    "dashboard.action.open_review_queue": "रिव्ह्यू क्यू उघडा",
    "dashboard.action.scan_docs": "दस्तऐवज स्कॅन करा",
    "dashboard.action.steel_hub": "स्टील हब",
    "dashboard.action.open_steel_control": "स्टील कंट्रोल उघडा",
    "dashboard.action.open_reconciliations": "रीकन्सिलिएशन्स उघडा",
    "dashboard.action.open_today_entry": "आजची एंट्री उघडा",
    "dashboard.action.open_7day_report": "7 दिवसांचा रिपोर्ट उघडा",
    "dashboard.action.open_monthly_review": "मासिक रिव्ह्यू उघडा",
    "dashboard.action.open_my_tasks": "माझी कामे उघडा",
    "dashboard.action.open_entry_form": "एंट्री फॉर्म उघडा",
    "dashboard.action.view_plans": "प्लॅन्स पहा",
    "dashboard.action.open_billing": "बिलिंग उघडा",
    "dashboard.action.open_ai": "AI इनसाइट्स उघडा",
    "dashboard.action.open_login": "लॉगिन उघडा",
    "dashboard.action.register": "नोंदणी",
    "dashboard.action.open_control_tower": "कंट्रोल टॉवर उघडा",
    "dashboard.action.open_analysis": "विश्लेषण उघडा",
    "dashboard.action.open_board": "बोर्ड उघडा",
    "dashboard.action.mark_read": "वाचले म्हणून चिन्हांकित करा",
    "dashboard.metric.alerts": "अलर्ट्स",
    "dashboard.metric.signals": "सिग्नल्स",
    "dashboard.metric.pending_shift": "प्रलंबित शिफ्ट",
    "dashboard.metric.today_entries": "आजच्या एंट्री",
    "dashboard.metric.pending_shifts_today": "आजच्या प्रलंबित शिफ्ट",
    "dashboard.metric.weekly_avg": "साप्ताहिक सरासरी कामगिरी",
    "dashboard.metric.recent_units": "अलीकडील युनिट्स",
    "dashboard.metric.offline_queue": "ऑफलाइन क्यू",
    "dashboard.quick.title": "शोधू नका, थेट काम करा",
    "dashboard.attention.title": "आता काय रिव्ह्यू करायचे",
    "dashboard.network.live": "नेटवर्क चालू आहे. कृती रिअल टाइममध्ये सिंक होतील.",
    "dashboard.network.offline": "ऑफलाइन मोड सक्रिय आहे. एंट्री स्थानिक पातळीवर जतन होईल आणि नंतर सिंक होईल.",
    "dashboard.primary.fallback_title": "पुढचे काम सुरू करा",
    "dashboard.primary.fallback_detail": "पुढच्या योग्य कृतीने फ्लोर चालू ठेवा.",
    "dashboard.unread_alerts": "न वाचलेले अलर्ट",
    "dashboard.active": "सक्रिय",
    "dashboard.recent_entries": "अलीकडील एंट्री",
    "dashboard.recent_activity": "नवीनतम उत्पादन क्रिया",
    "dashboard.entries.empty": "अजून कोणतीही एंट्री सबमिट झालेली नाही.",
    "dashboard.alert.none": "आत्ता न वाचलेले अलर्ट नाहीत.",
    "dashboard.ai.title": "AI विसंगती रडार",
    "dashboard.ai.subtitle": "फॅक्टरी ड्रिफ्ट प्रीव्ह्यू",
    "dashboard.ai.empty": "आत्ता कोणतेही विसंगती प्रीव्ह्यू उपलब्ध नाही.",
    "dashboard.ai.no_signals": "सध्याच्या प्रीव्ह्यू विंडोमध्ये कोणतेही विसंगती सिग्नल सक्रिय नाहीत.",
    "dashboard.top_signals": "टॉप सिग्नल्स",
    "dashboard.attention.now": "आत्ता कोणत्या गोष्टीकडे लक्ष द्यायचे",
    "dashboard.plan_limits.title": "प्लॅन आणि मर्यादा",
    "dashboard.current_period": "सध्याचा कालावधी",
    "dashboard.usage_summary": "वापर सारांश",
    "dashboard.requests": "रिक्वेस्ट्स",
    "dashboard.credits": "क्रेडिट्स",
    "dashboard.unlimited": "अमर्याद",
    "table.date": "दिनांक",
    "table.shift": "शिफ्ट",
    "table.department": "विभाग",
    "table.units": "युनिट्स",
    "table.downtime": "डाउनटाइम",
    "table.submitted": "सबमिट",
    "table.action": "क्रिया",
    "table.min": "मिनिट",
    "dashboard.session.missing": "सक्रिय सेशन सापडला नाही. लॉगिन स्क्रीनवर जा.",
    "dashboard.factory.active": "सक्रिय फॅक्टरी",
    "dashboard.factory.general": "सामान्य उत्पादन",
    "dashboard.organization.title": "संस्था",
    "dashboard.organization.current": "सध्याची संस्था",
    "dashboard.control_tower.title": "कंट्रोल टॉवर",
    "dashboard.production_trend": "उत्पादन ट्रेंड",
    "dashboard.last_7_days": "मागील 7 दिवस",
    "dashboard.window": "विंडो",
    "dashboard.mode": "मोड",
    "dashboard.preview": "प्रीव्ह्यू",
    "dashboard.steel.section": "स्टील कंट्रोल",
    "dashboard.steel.title": "स्टील कंट्रोल आता वेगळे मॉड्यूल आहे",
    "dashboard.offline.detail": "या ब्राउझरमधून सिंक होण्याची वाट पाहणाऱ्या एंट्री.",
    "dashboard.units.recent": "अलीकडील युनिट्स",
    "dashboard.alerts.unread": "न वाचलेले अलर्ट",
    "dashboard.metric.recent_units_detail_prefix": "अलीकडील",
    "dashboard.metric.recent_units_detail_suffix": "एंट्रीचा रोलिंग टोटल.",
    "dashboard.analytics.last_7_days": "मागील 7 उत्पादन दिवसांवर आधारित.",
    "dashboard.analytics.upgrade": "अॅनालिटिक्ससाठी फॅक्टरी प्लॅनमध्ये अपग्रेड करा.",
    "dashboard.analytics.empty": "आत्ता साप्ताहिक अॅनालिटिक्स डेटा उपलब्ध नाही.",
    "dashboard.card.eyebrow.start_work": "काम सुरू",
    "dashboard.card.eyebrow.capture": "कॅप्चर",
    "dashboard.card.eyebrow.stay_ahead": "आघाडी ठेवा",
    "dashboard.card.eyebrow.review": "रिव्ह्यू",
    "dashboard.card.eyebrow.control": "कंट्रोल",
    "dashboard.card.eyebrow.escalate": "एस्कलेट",
    "dashboard.card.eyebrow.grow": "वाढ",
    "dashboard.card.operator.title": "पुढची शिफ्ट एंट्री पूर्ण करा",
    "dashboard.card.operator.action": "शिफ्ट एंट्री उघडा",
    "dashboard.card.capture.title": "पेपर रेकॉर्ड पटकन आणा",
    "dashboard.card.capture.action": "डॉक्युमेंट कॅप्चर उघडा",
    "dashboard.card.alerts.title": "आजचे प्लांट सिग्नल पाहा",
    "dashboard.card.alerts.action": "अलर्ट रिव्ह्यू करा",
    "dashboard.card.supervisor.approval_title": "मंजुरी क्यू साफ करा",
    "dashboard.card.supervisor.approval_action": "मंजुरी इनबॉक्स उघडा",
    "dashboard.card.supervisor.stock_title": "स्टॉक ट्रस्ट आणि मिसमॅच तपासा",
    "dashboard.card.supervisor.escalate_title": "स्टील ऑपरेशन्स सुरू ठेवा",
    "dashboard.card.business.title": "व्यवसाय रिव्ह्यू लेयर उघडा",
    "dashboard.card.business.control_title": "प्रलंबित निर्णय एकाच ठिकाणी पहा",
    "dashboard.card.business.control_detail_review": "सुपरवायजरी काम आता एकाच इनबॉक्समध्ये आहे.",
    "dashboard.card.business.grow_title": "ऑपरेशन्स आणि कंपनी कंट्रोलमध्ये सहज जा",
    "dashboard.sync.starting": "ऑफलाइन क्यू सिंक होत आहे आणि डुप्लिकेट शिफ्ट तपासल्या जात आहेत...",
    "dashboard.sync.synced": "सिंक केले",
    "dashboard.sync.resolved": "निराकरण केले",
    "dashboard.sync.duplicate_conflicts": "डुप्लिकेट कॉन्फ्लिक्ट्स",
    "dashboard.sync.still_waiting": "अजून प्रतीक्षेत",
    "dashboard.sync.update_prefix": "ऑफलाइन क्यू अपडेट",
    "dashboard.sync.none_ready": "सिंकसाठी कोणतीही क्यू एंट्री तयार नव्हती.",
    "dashboard.sync.failed": "ऑफलाइन सिंक अयशस्वी झाली.",
    "dashboard.sync.syncing": "सिंक होत आहे...",
    "dashboard.alert.mark_read_failed": "अलर्ट वाचले म्हणून चिन्हांकित करता आले नाही.",
    "attendance.title": "दैनिक उपस्थिती आणि पंच नियंत्रण",
    "attendance.session.login_required": "उपस्थिती उघडण्यासाठी कृपया लॉगिन करा.",
    "attendance.action.open_shift_entry": "शिफ्ट एंट्री उघडा",
    "attendance.action.live_board": "लाइव्ह बोर्ड",
    "attendance.action.review_queue": "रिव्ह्यू क्यू",
    "attendance.action.refresh": "उपस्थिती रीफ्रेश करा",
    "attendance.action.refresh_short": "रीफ्रेश",
    "attendance.action.punch_in": "पंच इन",
    "attendance.action.punch_out": "पंच आउट",
    "attendance.action.recording": "रेकॉर्ड होत आहे...",
    "attendance.action.closing": "बंद होत आहे...",
    "attendance.status.punch_in_recorded": "उपस्थिती पंच-इन नोंदवला गेला.",
    "attendance.status.punch_out_recorded": "उपस्थिती पंच-आउट नोंदवला गेला.",
    "attendance.status.updating": "उपस्थिती अपडेट होत आहे...",
    "attendance.status.updated": "अपडेट",
    "attendance.status.live_updates": "दर 25 सेकंदांनी लाइव्ह अपडेट",
    "attendance.status.refreshing_background": "बॅकग्राउंडमध्ये उपस्थिती डेटा रीफ्रेश होत आहे...",
    "attendance.error.update_failed": "उपस्थिती अपडेट करता आली नाही.",
    "attendance.metric.date": "उपस्थिती दिनांक",
    "attendance.metric.worked_time": "काम केलेला वेळ",
    "attendance.metric.overtime": "ओव्हरटाइम",
    "attendance.metric.factory_code": "फॅक्टरी कोड",
    "attendance.metric.role": "भूमिका",
    "attendance.self_service.title": "सक्रिय शिफ्टसाठी पंच नियंत्रण",
    "attendance.night_shift_note": "नाईट शिफ्टमध्ये पंच-आउट मध्यरात्रीनंतरही उपलब्ध राहतो, त्यामुळे शिफ्ट सुरक्षितपणे बंद करता येते.",
    "attendance.tag.active_shift": "सक्रिय शिफ्ट",
    "attendance.tag.closed_today": "आजसाठी बंद",
    "attendance.tag.action_needed": "कृती आवश्यक",
    "role.operator": "ऑपरेटर",
    "role.attendance": "अटेंडन्स वर्कर",
    "role.supervisor": "सुपरवायझर",
    "role.accountant": "अकाउंटंट",
    "role.manager": "मॅनेजर",
    "role.admin": "अॅडमिन",
    "role.owner": "ओनर",
    "role.team_member": "टीम सदस्य",
  },
};

const PHRASE_TRANSLATIONS: Record<Exclude<AppLanguage, "en">, Record<string, string>> = {
  hi: {
    "Factory not selected": "फैक्टरी चयनित नहीं है",
    "Account Access": "अकाउंट एक्सेस",
    "Applies across all tabs instantly": "यह सभी टैब में तुरंत लागू होगा",
    "Work Queue": "वर्क क्यू",
    "Attendance": "अटेंडेंस",
    "Today Board": "टुडे बोर्ड",
    "My Day": "मेरा दिन",
    "Shift Entry": "शिफ्ट एंट्री",
    "Document Desk": "डॉक्यूमेंट डेस्क",
    "Steel Operations": "स्टील ऑपरेशन्स",
    "Customers": "कस्टमर्स",
    "Sales Invoices": "सेल्स इनवॉइस",
    "Dispatch": "डिस्पैच",
    "Attendance Review": "अटेंडेंस रिव्यू",
    "Review Queue": "रिव्यू क्यू",
    "Review Documents": "डॉक्यूमेंट रिव्यू",
    "Stock Review": "स्टॉक रिव्यू",
    "Attendance Reports": "अटेंडेंस रिपोर्ट्स",
    "Reports & Exports": "रिपोर्ट्स और एक्सपोर्ट्स",
    "Performance": "परफॉर्मेंस",
    "Owner Desk": "ओनर डेस्क",
    "Factory Network": "फैक्टरी नेटवर्क",
    "Scheduled Updates": "शेड्यूल्ड अपडेट्स",
    "AI Insights": "AI इनसाइट्स",
    "Attendance Admin": "अटेंडेंस एडमिन",
    "Factory Admin": "फैक्टरी एडमिन",
    "Subscription": "सब्सक्रिप्शन",
    "Billing & Invoices": "बिलिंग और इनवॉइस",
    "Profile": "प्रोफाइल",
    "Punch In": "पंच इन",
    "Punch Out": "पंच आउट",
    "Open Login": "लॉगिन खोलें",
    "Open Settings": "सेटिंग्स खोलें",
    "Open Reports": "रिपोर्ट खोलें",
    "Open Review Queue": "रिव्यू क्यू खोलें",
    "Open Control Tower": "कंट्रोल टॉवर खोलें",
    "Refresh Attendance": "अटेंडेंस रिफ्रेश करें",
    "Live Board": "लाइव बोर्ड",
    "Daily presence and punch control": "दैनिक उपस्थिति और पंच नियंत्रण",
    "Scan Document": "डॉक्यूमेंट स्कैन करें",
    "Upload from Gallery": "गैलरी से अपलोड करें",
    "Fixing image": "इमेज ठीक की जा रही है",
    "Detecting text": "टेक्स्ट पहचाना जा रहा है",
    "Extracting data": "डेटा निकाला जा रहा है",
    "Reading document...": "डॉक्यूमेंट पढ़ा जा रहा है...",
    "Save Draft": "ड्राफ्ट सेव करें",
    "Save": "सेव",
    "Retry": "फिर से प्रयास करें",
    "Back": "वापस",
    "Next": "आगे",
    "Close": "बंद करें",
    "Search": "खोजें",
    "Filter": "फ़िल्टर",
    "Status": "स्थिति",
    "Date": "तारीख",
    "Quantity": "मात्रा",
    "Material": "सामग्री",
    "Role": "भूमिका",
    "Factory": "फैक्टरी",
    "Settings": "सेटिंग्स",
    "Language": "भाषा",
  },
  mr: {
    "Factory not selected": "फॅक्टरी निवडलेली नाही",
    "Account Access": "अकाउंट प्रवेश",
    "Applies across all tabs instantly": "हे सर्व टॅबमध्ये त्वरित लागू होईल",
    "Work Queue": "वर्क क्यू",
    "Attendance": "उपस्थिती",
    "Today Board": "टुडे बोर्ड",
    "My Day": "माझा दिवस",
    "Shift Entry": "शिफ्ट एंट्री",
    "Document Desk": "डॉक्युमेंट डेस्क",
    "Steel Operations": "स्टील ऑपरेशन्स",
    "Customers": "कस्टमर्स",
    "Sales Invoices": "सेल्स इनवॉइस",
    "Dispatch": "डिस्पॅच",
    "Attendance Review": "उपस्थिती रिव्ह्यू",
    "Review Queue": "रिव्ह्यू क्यू",
    "Review Documents": "डॉक्युमेंट रिव्ह्यू",
    "Stock Review": "स्टॉक रिव्ह्यू",
    "Attendance Reports": "उपस्थिती रिपोर्ट्स",
    "Reports & Exports": "रिपोर्ट्स आणि एक्सपोर्ट्स",
    "Performance": "परफॉर्मन्स",
    "Owner Desk": "ओनर डेस्क",
    "Factory Network": "फॅक्टरी नेटवर्क",
    "Scheduled Updates": "शेड्यूल्ड अपडेट्स",
    "AI Insights": "AI इनसाइट्स",
    "Attendance Admin": "उपस्थिती अॅडमिन",
    "Factory Admin": "फॅक्टरी अॅडमिन",
    "Subscription": "सबस्क्रिप्शन",
    "Billing & Invoices": "बिलिंग आणि इनवॉइस",
    "Profile": "प्रोफाइल",
    "Punch In": "पंच इन",
    "Punch Out": "पंच आउट",
    "Open Login": "लॉगिन उघडा",
    "Open Settings": "सेटिंग्स उघडा",
    "Open Reports": "रिपोर्ट उघडा",
    "Open Review Queue": "रिव्ह्यू क्यू उघडा",
    "Open Control Tower": "कंट्रोल टॉवर उघडा",
    "Refresh Attendance": "उपस्थिती रीफ्रेश करा",
    "Live Board": "लाइव्ह बोर्ड",
    "Daily presence and punch control": "दैनिक उपस्थिती आणि पंच नियंत्रण",
    "Scan Document": "डॉक्युमेंट स्कॅन करा",
    "Upload from Gallery": "गॅलरीतून अपलोड करा",
    "Fixing image": "इमेज दुरुस्त होत आहे",
    "Detecting text": "टेक्स्ट शोधला जात आहे",
    "Extracting data": "डेटा काढला जात आहे",
    "Reading document...": "डॉक्युमेंट वाचले जात आहे...",
    "Save Draft": "ड्राफ्ट सेव करा",
    "Save": "सेव",
    "Retry": "पुन्हा प्रयत्न करा",
    "Back": "मागे",
    "Next": "पुढे",
    "Close": "बंद करा",
    "Search": "शोधा",
    "Filter": "फिल्टर",
    "Status": "स्थिती",
    "Date": "दिनांक",
    "Quantity": "प्रमाण",
    "Material": "साहित्य",
    "Role": "भूमिका",
    "Factory": "फॅक्टरी",
    "Settings": "सेटिंग्स",
    "Language": "भाषा",
  },
};

const WORD_TRANSLATIONS: Record<Exclude<AppLanguage, "en">, Record<string, string>> = {
  hi: {
    account: "अकाउंट",
    access: "एक्सेस",
    active: "सक्रिय",
    admin: "एडमिन",
    ai: "AI",
    and: "और",
    attendance: "अटेंडेंस",
    back: "वापस",
    batch: "बैच",
    billing: "बिलिंग",
    board: "बोर्ड",
    camera: "कैमरा",
    close: "बंद करें",
    control: "कंट्रोल",
    customer: "कस्टमर",
    customers: "कस्टमर्स",
    dashboard: "डैशबोर्ड",
    data: "डेटा",
    date: "तारीख",
    desk: "डेस्क",
    detect: "पहचानें",
    detecting: "पहचान रहा है",
    dispatch: "डिस्पैच",
    document: "डॉक्यूमेंट",
    draft: "ड्राफ्ट",
    entry: "एंट्री",
    export: "एक्सपोर्ट",
    exports: "एक्सपोर्ट्स",
    factory: "फैक्टरी",
    factories: "फैक्ट्रियाँ",
    filter: "फ़िल्टर",
    fix: "ठीक करें",
    fixing: "ठीक किया जा रहा है",
    free: "फ्री",
    gallery: "गैलरी",
    image: "इमेज",
    industry: "उद्योग",
    insights: "इनसाइट्स",
    invoice: "इनवॉइस",
    invoices: "इनवॉइस",
    language: "भाषा",
    live: "लाइव",
    loading: "लोड हो रहा है",
    login: "लॉगिन",
    logout: "लॉगआउट",
    material: "सामग्री",
    my: "मेरा",
    network: "नेटवर्क",
    next: "आगे",
    open: "खोलें",
    operations: "ऑपरेशन्स",
    owner: "ओनर",
    pending: "लंबित",
    performance: "परफॉर्मेंस",
    pinned: "पिन",
    plan: "प्लान",
    processing: "प्रोसेसिंग",
    profile: "प्रोफाइल",
    quantity: "मात्रा",
    queue: "क्यू",
    refresh: "रिफ्रेश",
    report: "रिपोर्ट",
    reports: "रिपोर्ट्स",
    retry: "फिर से प्रयास करें",
    review: "रिव्यू",
    role: "भूमिका",
    sales: "सेल्स",
    save: "सेव",
    scan: "स्कैन",
    scheduled: "शेड्यूल्ड",
    search: "खोजें",
    settings: "सेटिंग्स",
    shift: "शिफ्ट",
    status: "स्थिति",
    steel: "स्टील",
    subscription: "सब्सक्रिप्शन",
    switch: "बदलें",
    team: "टीम",
    text: "टेक्स्ट",
    today: "आज",
    tower: "टॉवर",
    update: "अपडेट",
    updates: "अपडेट्स",
    upload: "अपलोड",
    work: "वर्क",
  },
  mr: {
    account: "अकाउंट",
    access: "प्रवेश",
    active: "सक्रिय",
    admin: "अॅडमिन",
    ai: "AI",
    and: "आणि",
    attendance: "उपस्थिती",
    back: "मागे",
    batch: "बॅच",
    billing: "बिलिंग",
    board: "बोर्ड",
    camera: "कॅमेरा",
    close: "बंद करा",
    control: "कंट्रोल",
    customer: "कस्टमर",
    customers: "कस्टमर्स",
    dashboard: "डॅशबोर्ड",
    data: "डेटा",
    date: "दिनांक",
    desk: "डेस्क",
    detect: "शोधा",
    detecting: "शोधला जात आहे",
    dispatch: "डिस्पॅच",
    document: "डॉक्युमेंट",
    draft: "ड्राफ्ट",
    entry: "एंट्री",
    export: "एक्सपोर्ट",
    exports: "एक्सपोर्ट्स",
    factory: "फॅक्टरी",
    factories: "फॅक्टऱ्या",
    filter: "फिल्टर",
    fix: "दुरुस्त करा",
    fixing: "दुरुस्त होत आहे",
    free: "फ्री",
    gallery: "गॅलरी",
    image: "इमेज",
    industry: "उद्योग",
    insights: "इनसाइट्स",
    invoice: "इनवॉइस",
    invoices: "इनवॉइस",
    language: "भाषा",
    live: "लाइव्ह",
    loading: "लोड होत आहे",
    login: "लॉगिन",
    logout: "लॉगआउट",
    material: "साहित्य",
    my: "माझा",
    network: "नेटवर्क",
    next: "पुढे",
    open: "उघडा",
    operations: "ऑपरेशन्स",
    owner: "ओनर",
    pending: "प्रलंबित",
    performance: "परफॉर्मन्स",
    pinned: "पिन",
    plan: "प्लॅन",
    processing: "प्रोसेसिंग",
    profile: "प्रोफाइल",
    quantity: "प्रमाण",
    queue: "क्यू",
    refresh: "रीफ्रेश",
    report: "रिपोर्ट",
    reports: "रिपोर्ट्स",
    retry: "पुन्हा प्रयत्न करा",
    review: "रिव्ह्यू",
    role: "भूमिका",
    sales: "सेल्स",
    save: "सेव",
    scan: "स्कॅन",
    scheduled: "शेड्यूल्ड",
    search: "शोधा",
    settings: "सेटिंग्स",
    shift: "शिफ्ट",
    status: "स्थिती",
    steel: "स्टील",
    subscription: "सबस्क्रिप्शन",
    switch: "बदला",
    team: "टीम",
    text: "टेक्स्ट",
    today: "आज",
    tower: "टॉवर",
    update: "अपडेट",
    updates: "अपडेट्स",
    upload: "अपलोड",
    work: "वर्क",
  },
};

type CachedTranslation = {
  source: string;
  rendered: string;
};

const textNodeCache = new WeakMap<Text, CachedTranslation>();
const attributeCache = new WeakMap<Element, Map<string, CachedTranslation>>();

const I18nContext = createContext<I18nContextValue | null>(null);
const languageListeners = new Set<() => void>();

function parseLanguage(value: string | null | undefined): AppLanguage {
  if (!value) return DEFAULT_LANGUAGE;
  return VALID_LANGUAGES.includes(value as AppLanguage)
    ? (value as AppLanguage)
    : DEFAULT_LANGUAGE;
}

function normalizeTranslationValue(value: string): string {
  if (!value || !MOJIBAKE_PATTERN.test(value)) {
    return value;
  }

  try {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code > 255) {
        return value;
      }
      bytes[index] = code;
    }
    const decoded = new TextDecoder("utf-8").decode(bytes);
    if (!decoded || decoded.includes("\uFFFD")) {
      return value;
    }
    return decoded;
  } catch {
    return value;
  }
}

function normalizePhraseKey(value: string): string {
  return normalizeTranslationValue(value).replace(NORMALIZED_SPACE_PATTERN, " ").trim();
}

function translateExactPhrase(value: string, language: Exclude<AppLanguage, "en">): string | null {
  const normalized = normalizePhraseKey(value);
  if (!normalized) return null;
  return PHRASE_TRANSLATIONS[language][normalized] || null;
}

function translateWords(value: string, language: Exclude<AppLanguage, "en">): string {
  let translatedCount = 0;
  let totalWords = 0;

  const translated = value.replace(WORD_PATTERN, (token) => {
    totalWords += 1;
    const next = WORD_TRANSLATIONS[language][token.toLowerCase()];
    if (!next) {
      return token;
    }
    translatedCount += 1;
    return next;
  });

  if (!translatedCount) {
    return value;
  }

  const ratio = translatedCount / Math.max(totalWords, 1);
  if (translatedCount >= 2 || ratio >= 0.6) {
    return translated;
  }

  return value;
}

function translatePhraseText(value: string, language: AppLanguage): string {
  const normalized = normalizeTranslationValue(value);
  if (!normalized || language === "en") {
    return normalized;
  }

  const exact = translateExactPhrase(normalized, language);
  if (exact) {
    return exact;
  }

  return translateWords(normalized, language);
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest("[data-no-auto-translate='true']")) return true;

  const tagName = parent.tagName;
  return tagName === "CODE" || tagName === "NOSCRIPT" || tagName === "PRE" || tagName === "SCRIPT" || tagName === "STYLE";
}

function syncCachedTranslation(
  currentValue: string,
  cached: CachedTranslation | undefined,
): CachedTranslation {
  if (!cached) {
    return { source: currentValue, rendered: currentValue };
  }

  if (currentValue !== cached.rendered && currentValue !== cached.source) {
    return { source: currentValue, rendered: currentValue };
  }

  return cached;
}

function applyTextTranslation(node: Text, language: AppLanguage) {
  if (shouldSkipTextNode(node)) {
    return;
  }

  const currentValue = node.nodeValue ?? "";
  if (!currentValue.trim()) {
    return;
  }

  const cached = syncCachedTranslation(currentValue, textNodeCache.get(node));
  const nextValue = language === "en" ? cached.source : translatePhraseText(cached.source, language);
  cached.rendered = nextValue;
  textNodeCache.set(node, cached);

  if (currentValue !== nextValue) {
    node.nodeValue = nextValue;
  }
}

function applyAttributeTranslation(
  element: Element,
  attributeName: (typeof TRANSLATABLE_ATTRIBUTES)[number],
  language: AppLanguage,
) {
  const currentValue = element.getAttribute(attributeName);
  if (!currentValue) {
    return;
  }

  const cachedAttributes = attributeCache.get(element) ?? new Map<string, CachedTranslation>();
  const cached = syncCachedTranslation(currentValue, cachedAttributes.get(attributeName));
  const nextValue = language === "en" ? cached.source : translatePhraseText(cached.source, language);
  cached.rendered = nextValue;
  cachedAttributes.set(attributeName, cached);
  attributeCache.set(element, cachedAttributes);

  if (currentValue !== nextValue) {
    element.setAttribute(attributeName, nextValue);
  }
}

function translateDomSubtree(root: Node, language: AppLanguage) {
  if (typeof document === "undefined") {
    return;
  }

  if (root.nodeType === Node.TEXT_NODE) {
    applyTextTranslation(root as Text, language);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const element = root as Element;
  for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
    applyAttributeTranslation(element, attributeName, language);
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let currentNode: Node | null = walker.currentNode;

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      applyTextTranslation(currentNode as Text, language);
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
        applyAttributeTranslation(currentNode as Element, attributeName, language);
      }
    }
    currentNode = walker.nextNode();
  }
}

function subscribeLanguage(listener: () => void) {
  languageListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    languageListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getLanguageSnapshot() {
  if (typeof window === "undefined") {
    return LANGUAGE_SERVER_SNAPSHOT;
  }
  return parseLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

function getLanguageServerSnapshot() {
  return LANGUAGE_SERVER_SNAPSHOT;
}

function writeLanguage(next: AppLanguage) {
  if (typeof window === "undefined") {
    return;
  }

  const parsed = parseLanguage(next);
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, parsed);
  languageListeners.forEach((listener) => listener());
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getLanguageServerSnapshot,
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const locale = LANGUAGE_LOCALE_MAP[language] || LANGUAGE_LOCALE_MAP.en;

  const setLanguage = useCallback((next: AppLanguage) => {
    writeLanguage(next);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      if (!key) return fallback || "";
      if (language === "en") return fallback || key;
      const value = TRANSLATIONS[language][key];
      const normalized = value ? normalizeTranslationValue(value) : undefined;
      return normalized || fallback || key;
    },
    [language],
  );

  const tp = useCallback((text: string) => translatePhraseText(text, language), [language]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    translateDomSubtree(document.body, language);

    if (language === "en") {
      return;
    }

    let rafId = 0;
    const pendingNodes = new Set<Node>();

    const flushPendingNodes = () => {
      rafId = 0;
      pendingNodes.forEach((node) => translateDomSubtree(node, language));
      pendingNodes.clear();
    };

    const queueNode = (node: Node) => {
      pendingNodes.add(node);
      if (!rafId) {
        rafId = window.requestAnimationFrame(flushPendingNodes);
      }
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => queueNode(node));
        } else if (mutation.type === "characterData") {
          queueNode(mutation.target);
        } else if (mutation.type === "attributes") {
          queueNode(mutation.target);
        }
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });

    return () => {
      observer.disconnect();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      locale,
      setLanguage,
      t,
      tp,
    }),
    [language, locale, setLanguage, t, tp],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return ctx;
}

export function localeForLanguage(language: AppLanguage): string {
  return LANGUAGE_LOCALE_MAP[language] || LANGUAGE_LOCALE_MAP.en;
}
