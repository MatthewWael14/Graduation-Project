import { C } from "../styles/theme";

export const NAV = [
  { id: "dashboard",  label: "Dashboard",       icon: "◈", dot: C.orange },
  { id: "sla",        label: "SLA Upload",       icon: "◉", dot: C.purple },
  { id: "inventory",  label: "Inventory Risk",   icon: "⬢", dot: C.red    },
  { id: "suppliers",  label: "Suppliers",        icon: "◎", dot: C.green  },
  { id: "violations", label: "SLA Violations",   icon: "◆", dot: C.orange },
  { id: "ai",         label: "AI Assistant",     icon: "◑", dot: C.purple },
  { id: "alerts",     label: "Alerts",           icon: "🔔", dot: C.red    },
];

export const PAGE_TITLES = {
  dashboard:  "Dashboard · Mission Control",
  sla:        "SLA Upload · LLM Parser",
  inventory:  "Inventory Risk · Traffic Light",
  suppliers:  "Suppliers · Directory",
  violations: "SLA Violations · Penalty Calculator",
  ai:         "AI Assistant · Natural Language Query",
  alerts:     "Alerts · Notifications Center",
};

export const kpiData = [
  { label: "Active Suppliers",  value: "47",   change: "+3",   up: true,  color: C.blue,   icon: "🏭" },
  { label: "At-Risk Shipments", value: "12",   change: "+5",   up: false, color: C.orange, icon: "⚠"  },
  { label: "SLA Compliance",    value: "84%",  change: "-2%",  up: false, color: C.green,  icon: "📋" },
  { label: "Avg Delay (days)",  value: "3.2",  change: "-0.8", up: true,  color: C.purple, icon: "⏱"  },
  { label: "Total Penalties",   value: "$248K",change: "+18%", up: false, color: C.red,    icon: "💰" },
  { label: "Alerts (48h)",      value: "7",    change: "+2",   up: false, color: C.pink,   icon: "🔔" },
];

export const supplierData = [
  { id:"SUP-001", name:"AlphaMetal Co.", country:"Germany", countryCode:"DE", onTime:91, risk:"LOW", shipments:24, score:88, tier:"HIGH", capacity:85, leadTime:6, material:"Steel Alloy A-12", emergency_cost:1.2, contact:"Klaus Weber", email:"k.weber@alphametal.de", phone:"+49 30 1234 5678", address:"Industriestr. 12, Berlin, Germany", since:"2019", certifications:["ISO 9001","ISO 14001"], notes:"Preferred steel supplier. Consistently high on-time rate." },
  { id:"SUP-002", name:"ChemSource Ltd.", country:"China", countryCode:"CN", onTime:67, risk:"HIGH", shipments:18, score:54, tier:"MEDIUM", capacity:60, leadTime:14, material:"Polymer Resin P-9", emergency_cost:2.1, contact:"Li Wei", email:"li.wei@chemsource.cn", phone:"+86 21 9876 5432", address:"Chemical Industrial Zone, Shanghai, China", since:"2021", certifications:["ISO 9001"], notes:"Recent delays due to port congestion. Under review." },
  { id:"SUP-003", name:"SinoFab Industries", country:"China", countryCode:"CN", onTime:78, risk:"MEDIUM", shipments:31, score:70, tier:"MEDIUM", capacity:72, leadTime:10, material:"Circuit Board v3", emergency_cost:1.8, contact:"Zhang Mei", email:"z.mei@sinofab.cn", phone:"+86 755 8765 4321", address:"Tech Park, Shenzhen, China", since:"2020", certifications:["ISO 9001","RoHS"], notes:"Good capacity. Slight delivery variance in Q1." },
  { id:"SUP-004", name:"EuroComp AG", country:"Austria", countryCode:"AT", onTime:95, risk:"LOW", shipments:12, score:93, tier:"HIGH", capacity:90, leadTime:5, material:"Hydraulic Valve HV-7", emergency_cost:1.1, contact:"Anna Schmidt", email:"a.schmidt@eurocomp.at", phone:"+43 1 2345 6789", address:"Wiener Strasse 44, Vienna, Austria", since:"2018", certifications:["ISO 9001","ISO 14001","CE"], notes:"Top-tier supplier. Excellent compliance record." },
  { id:"SUP-005", name:"RapidRaw LLC", country:"United States", countryCode:"US", onTime:42, risk:"CRITICAL", shipments:9, score:31, tier:"LOW", capacity:40, leadTime:21, material:"Lithium Carbonate", emergency_cost:3.4, contact:"John Miller", email:"j.miller@rapidraw.com", phone:"+1 702 555 0199", address:"1200 Desert Road, Las Vegas, NV, USA", since:"2022", certifications:["ISO 9001"], notes:"CRITICAL: Multiple failed deliveries. SLA breach active." },
  { id:"SUP-006", name:"NordicParts AS", country:"Norway", countryCode:"NO", onTime:88, risk:"LOW", shipments:15, score:85, tier:"HIGH", capacity:80, leadTime:7, material:"Steel Alloy A-12", emergency_cost:1.3, contact:"Erik Larsen", email:"e.larsen@nordicparts.no", phone:"+47 22 123 456", address:"Industrivegen 8, Oslo, Norway", since:"2019", certifications:["ISO 9001","ISO 14001"], notes:"Reliable secondary supplier for steel materials." },
  { id:"SUP-007", name:"EuroMinerals GmbH", country:"Germany", countryCode:"DE", onTime:90, risk:"LOW", shipments:11, score:87, tier:"HIGH", capacity:75, leadTime:8, material:"Lithium Carbonate", emergency_cost:1.5, contact:"Hans Müller", email:"h.muller@eurominerals.de", phone:"+49 89 9876 5432", address:"Mineralweg 5, Munich, Germany", since:"2020", certifications:["ISO 9001","ISO 14001","REACH"], notes:"Best fallback for Lithium Carbonate. REACH certified." },
  { id:"SUP-008", name:"AsiaLink Corp.", country:"South Korea", countryCode:"KR", onTime:82, risk:"MEDIUM", shipments:20, score:76, tier:"MEDIUM", capacity:65, leadTime:9, material:"Circuit Board v3", emergency_cost:1.6, contact:"Park Ji-ho", email:"j.park@asialink.kr", phone:"+82 2 1234 5678", address:"Digital Valley, Seoul, South Korea", since:"2021", certifications:["ISO 9001","RoHS","UL"], notes:"Good electronics supplier. Capacity expanding in Q2." },
];

export const slaData = [
  { id:"SLA-001", supplier:"AlphaMetal Co.",     material:"Steel Alloy A-12",     deadline:"2026-03-15", compliance:91, risk:"LOW",      penalty:"$5,000/day",  penaltyDaily:5000,  delayDays:0, violationStatus:false, gracePeriod:"24h", clause:"Clause 3.2" },
  { id:"SLA-002", supplier:"ChemSource Ltd.",    material:"Polymer Resin P-9",    deadline:"2026-03-10", compliance:67, risk:"HIGH",     penalty:"$12,000/day", penaltyDaily:12000, delayDays:4, violationStatus:true,  gracePeriod:"48h", clause:"Clause 4.1" },
  { id:"SLA-003", supplier:"SinoFab Industries", material:"Circuit Board v3",     deadline:"2026-03-18", compliance:78, risk:"MEDIUM",   penalty:"$8,500/day",  penaltyDaily:8500,  delayDays:2, violationStatus:false, gracePeriod:"48h", clause:"Clause 2.7" },
  { id:"SLA-004", supplier:"EuroComp AG",        material:"Hydraulic Valve HV-7", deadline:"2026-03-22", compliance:95, risk:"LOW",      penalty:"$3,000/day",  penaltyDaily:3000,  delayDays:0, violationStatus:false, gracePeriod:"12h", clause:"Clause 5.1" },
  { id:"SLA-005", supplier:"RapidRaw LLC",       material:"Lithium Carbonate",    deadline:"2026-03-08", compliance:42, risk:"CRITICAL", penalty:"$25,000/day", penaltyDaily:25000, delayDays:8, violationStatus:true,  gracePeriod:"48h", clause:"Clause 4.2" },
];

export const inventoryRisks = [
  { material:"Lithium Carbonate",    stock:3,  threshold:10, risk:"CRITICAL", trafficLight:"RED",    impact:"Battery production halt", delay:8, processes:["Assembly Line B","Quality Control"], delayProb:92, supplierID:"SUP-005" },
  { material:"Polymer Resin P-9",    stock:6,  threshold:15, risk:"HIGH",     trafficLight:"RED",    impact:"Casing line slowdown",    delay:5, processes:["Casing Mold Line","Packaging"],      delayProb:74, supplierID:"SUP-002" },
  { material:"Circuit Board v3",     stock:22, threshold:20, risk:"MEDIUM",   trafficLight:"YELLOW", impact:"Assembly delay risk",     delay:2, processes:["PCB Assembly","Final Test"],         delayProb:45, supplierID:"SUP-003" },
  { material:"Steel Alloy A-12",     stock:54, threshold:30, risk:"LOW",      trafficLight:"GREEN",  impact:"None imminent",           delay:0, processes:[],                                    delayProb:12, supplierID:"SUP-001" },
  { material:"Hydraulic Valve HV-7", stock:41, threshold:25, risk:"LOW",      trafficLight:"GREEN",  impact:"None imminent",           delay:0, processes:[],                                    delayProb:8,  supplierID:"SUP-004" },
];

export const fallbackMap = {
  "Lithium Carbonate": ["SUP-007","SUP-006"],
  "Polymer Resin P-9": ["SUP-001","SUP-003"],
  "Circuit Board v3":  ["SUP-008","SUP-004"],
  "Steel Alloy A-12":  ["SUP-006","SUP-001"],
};

export const swrlRules = [
  { rule:"IF Delay > 3d AND Stock < Threshold → Risk = HIGH", status:"FIRED",  count:3 },
  { rule:"IF Supplier.OnTime < 50% → Risk = CRITICAL",        status:"FIRED",  count:1 },
  { rule:"IF SLA.Compliance < 70% → Alert = TRUE",            status:"FIRED",  count:2 },
  { rule:"IF Stock > 2×Threshold → Risk = LOW",               status:"ACTIVE", count:8 },
];

export const chatHistory = [
  { role:"assistant", text:"Hello! I'm your Supply Chain AI Assistant, connected to the Knowledge Graph via SPARQL.\n\nYou can ask me things like:\n• \"What is impacted if Lithium Carbonate is late?\"\n• \"Show me fallback suppliers for RapidRaw LLC\"\n• \"Which SLAs are currently breached and what are the penalties?\"" },
];

export const getAlertsForRole = (role) => {
  const base = [
    { id:1, icon:"🔴", type:"CRITICAL", category:"SLA Breach", title:"SLA Breach — RapidRaw LLC", desc:"Lithium Carbonate delivery is overdue by 8 days. Financial penalty of $25,000/day accruing under Clause 4.2. Total exposure: $200,000.", time:"2m ago", date:"2026-03-09 08:04", unread:true, from:null, roles:["admin","logistics","procurement","production"] },
    { id:2, icon:"🟠", type:"HIGH", category:"Supplier Risk", title:"High Risk — ChemSource Ltd.", desc:"SLA compliance has dropped to 67%. Two consecutive late deliveries detected. Recommend escalation.", time:"18m ago", date:"2026-03-09 07:48", unread:true, from:null, roles:["admin","logistics","procurement"] },
    { id:3, icon:"🟠", type:"HIGH", category:"Inventory", title:"Low Stock — Polymer Resin P-9", desc:"Current stock is 6 units, below threshold of 15. Predicted delay +5 days. Casing Mold Line at risk.", time:"1h ago", date:"2026-03-09 07:06", unread:true, from:null, roles:["admin","logistics","production"] },
    { id:4, icon:"🔴", type:"CRITICAL", category:"Inventory", title:"Critical Stock — Lithium Carbonate", desc:"Only 3 units remain against threshold of 10. Assembly Line B faces imminent halt. ML delay probability: 92%.", time:"2h ago", date:"2026-03-09 06:06", unread:true, from:null, roles:["admin","logistics","production"] },
    { id:5, icon:"📩", type:"ESCALATION", category:"Escalation", title:"Escalation from Ahmed Hassan (Logistics)", desc:"Logistics Manager has escalated SLA-005 (RapidRaw LLC – Lithium Carbonate) for urgent procurement review. Penalty exposure: $200,000. Immediate supplier contact required.", time:"30m ago", date:"2026-03-09 07:36", unread:true, from:"Ahmed Hassan", fromRole:"Logistics Manager", roles:["procurement","admin"] },
    { id:6, icon:"📩", type:"ESCALATION", category:"Escalation", title:"Escalation from Sara Khalil (Procurement)", desc:"Procurement Manager has flagged SLA-002 (ChemSource Ltd.) for production impact review. Polymer Resin P-9 shortage may halt Casing Mold Line within 48 hours.", time:"45m ago", date:"2026-03-09 07:21", unread:true, from:"Sara Khalil", fromRole:"Procurement Manager", roles:["production","admin"] },
    { id:7, icon:"🔵", type:"INFO", category:"System", title:"ML Model Retrained", desc:"The delay prediction model has been successfully retrained. New accuracy: 91.3%.", time:"3h ago", date:"2026-03-09 05:06", unread:false, from:null, roles:["admin"] },
    { id:8, icon:"🟢", type:"LOW", category:"SLA", title:"SLA-004 Compliant — EuroComp AG", desc:"EuroComp AG confirmed on-time delivery of Hydraulic Valve HV-7. SLA compliance at 95%.", time:"5h ago", date:"2026-03-09 03:06", unread:false, from:null, roles:["admin","procurement"] },
    { id:9, icon:"🟠", type:"HIGH", category:"SLA Breach", title:"SLA Breach — ChemSource Ltd.", desc:"Polymer Resin P-9 delivery overdue by 4 days. Penalty of $12,000/day accruing under Clause 4.1. Total: $48,000.", time:"6h ago", date:"2026-03-09 02:06", unread:false, from:null, roles:["admin","procurement"] },
  ];
  return base.filter(a => a.roles.includes(role));
};
