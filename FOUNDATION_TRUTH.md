# AJ's RESTAURANT OPERATIONS PLATFORM
# Master Foundation Truth Document — Separated Edition

**Version:** 2.0 (Separated)
**Date:** March 2026
**Source:** Derived from v1.0 Foundation Architecture Truth Document

---

## HOW THIS DOCUMENT IS ORGANIZED

This document has been separated from a single monolithic file into categorized sections. Each section can be distributed independently to the relevant app's development environment.

### Section Distribution Guide:

| App | Gets These Sections |
|-----|-------------------|
| **All Apps** | A (Platform-Wide) + F (Operational Philosophy) + their own section |
| **App 1 — Inventory & Food Cost** | A + F + B + G (Competitive: MarginEdge, Solink) + H (Appendices) |
| **App 2 — Keno & Financial** | A + F + C |
| **App 3 — HR / PolicyVault** | A + F + D |
| **App 4 — Task & Scheduling** | A + F + E + G (Competitive: 7shifts/7tasks) |

### Critical Architectural Note:
The Inventory Core (described in Section B, Part 19) is the shared backend API for **kitchen apps only**. App 2 (Keno) and App 3 (HR) are architecturally independent. App 4 (Task & Scheduling) connections have not been determined.

---

## DOCUMENT PREAMBLE

RESTAURANT OPERATIONS PLATFORM Foundational Architecture Truth Document Version 1.0 | March 2026 | Derived from AJ's Trailside Pub operational audit DOCUMENT PURPOSE This document captures the foundational business logic, operational truths, and system design decisions that govern how the Restaurant Operations Platform must be built. It is not a UI spec. It is not a feature list. It is the ground truth that every developer, every AI assistant, and every future build session must start from before writing a single line of code. Every rule in this document was derived from real operational experience running a full-service restaurant. These are not theoretical best practices — they are hard-learned truths about how restaurant operations actually work versus how software systems assume they work.

---

## SECTION INDEX

- **Section A:** Platform-Wide Truths (Parts 8, 14, 15, 18, 20, 24)
- **Section B:** App 1 — Inventory & Food Cost (Parts 1-7, 9-11, 16-17, 19, 22-23, 27-30, 34)
- **Section C:** App 2 — Keno & Financial Tracker (Part 12)
- **Section D:** App 3 — HR Policy & Handbook (Part 13)
- **Section E:** App 4 — Task & Scheduling (Parts 21, 25)
- **Section F:** Operational Philosophy (Part 26)
- **Section G:** Competitive Landscape (Parts 31, 32)
- **Section H:** Appendices (Confirmed Prices, Version History)
-e 


# PLATFORM-WIDE TRUTHS

**Scope:** These truths apply to ALL apps in the platform. Every app should include this section.

**⚠️ IMPORTANT: The Inventory Core (Truths 88-92) is the shared backend for KITCHEN APPS ONLY (Ordering, Food Cost, Kitchen, Multi-Vendor). The Keno app and HR app are architecturally independent.**

---

PART 8 — PLATFORM ARCHITECTURE TRUTHS TRUTH #37 — The three apps are independent but share a common data architecture App 1 — Inventory & Invoice Intelligence: supply chain, food cost, recipe management. App 2 — Keno Gaming: revenue transaction system, mathematically fair probability engine. App 3 — HR Policy & Compliance: workforce documentation, policy acknowledgment, training records. → Each app runs on its own server and database. → They share: multi-business structure, multi-location structure, user authentication, organizational profile. → They do not share: operational data, cost records, transaction records. TRUTH #38 — The platform must support multi-business and multi-location from day one — not as an afterthought [CRITICAL] The architecture must assume from the first line of code that multiple businesses will use this system. Each business has isolated data, isolated settings, isolated users. Each business can have multiple locations with location-level inventory and operational data. → Single-tenant thinking now = expensive re-architecture later. → Every database table must have a business_id and location_id foreign key from the start. TRUTH #39 — Invoice ingestion is the engine that makes the cost system self-maintaining [CRITICAL] Manual price entry is a one-time founder activity — not a sustainable operational workflow. The path to a fully automated cost model is: invoice received → ingested into App 1 → prices update → food costs recalculate → alerts fire if thresholds crossed. Wohrle's app already structures data with GTIN, net weight, price per lb, supplier — machine-readable. Sysco Shop has order history and invoice data — potential API integration target. → The long-term goal is zero manual price entry after initial setup. → Every manual price entry in the system should be flagged as 'pending invoice confirmation'. TRUTH #40 — The system must be designed for the operator who is also a parent, also a developer, also running everything alone [CRITICAL] Time is the most constrained resource — not money, not technical capability. Every workflow must be completable in under 2 minutes on a phone. Alerts must be actionable — not informational. 'Haddock cost crossed 40% threshold — suggested price: $21.99' is actionable. 'Your food cost is high' is not. The system does the analysis. The operator makes the decision. That division of labor is sacred. → Automation is not a feature. It is the entire point.

---

PART 14 - SUPER ADMIN, PLATFORM GOVERNANCE AND INTERCONNECTION - VERIFIED AND EXPANDED TRUTH #57 — Super admin is one person only - the platform creator - with a separate dashboard per app [CRITICAL] Super admin is the platform creator. One person. One role. Never assigned to anyone else. Not a role that gets created or managed within any app. Each app has its own super admin dashboard. Not one unified dashboard for all apps. The HR app super admin dashboard shows all businesses that signed up for the HR app. The Inventory app super admin dashboard shows all businesses that signed up for the Inventory app. Separate views per app. The super admin dashboard for each app shows: business name, owner/admin name, admin email, location address, signup date, account status. LAUNCH BUTTON: Next to each location there is a launch button. Super admin clicks it and sees exactly what the admin of that location sees. No difference in the view. Option A confirmed. THREE TEST ACCOUNTS: mccarthy.amyg@gmail.com = super admin for all apps. ajstrailsidepub@gmail.com = owner/admin of AJs Trailside Pub. ames0304@gmail.com = test employee. When logged in with any of these emails the app detects the role and routes to the correct experience automatically. The super admin diagnostic overlay — system flags, override tools, platform-level controls — is a planned future layer. Not Phase 1. Gets designed when real troubleshooting situations reveal what tools are actually needed. TRUTH #57 — Super admin access is governed by privacy obligations and logged always [CRITICAL] Having technical access does not equal permission to access freely. Every super admin launch into a business account is logged. Timestamp, which account, duration, actions taken. Super admin access is for platform support and maintenance only. Not for business intelligence. Not for competitive analysis. Not for curiosity. Business data belongs to the business. The platform creator is a trusted custodian not an owner of that data. Terms of service required at signup covers: data ownership — business owns their data. Access limitations — super admin access for support only. Data portability — businesses can export their data at any time. Data retention — what happens to data if subscription lapses. Confidentiality — data never shared, sold, or used outside platform operations. Being explicit and transparent about what the super admin can and cannot see — and building the audit trail that proves it — is a competitive advantage. Small business owners are rightfully suspicious of cloud software that can see their employee records. Transparency builds trust. TRUTH #165 — The permission architecture is closed by default — admin consciously opens capabilities [CRITICAL] TWO BASE ROLES — cannot be changed: Admin has full access. Employee has everything locked, the absolute minimum. These are fixed. MANAGER ROLE: Exists as a role label. Starts with identical permissions to Employee — fully locked, zero opened by default. Security first. The admin consciously decides what a manager can access. Nothing is pre-opened for manager. HOW PERMISSIONS WORK: The system defines what capabilities are available to be opened. The admin decides what actually gets opened for each role at their specific location. Admin goes into settings and manually opens specific capabilities for the manager role one by one. FUTURE STATE: Admins can create custom role names — Lead Server, Kitchen Supervisor, whatever the business calls it. Assign permissions to that custom role the same way. The backend for permissions gets built once correctly. Role names and permission assignments become admin-controlled configuration not developer-defined constants. The permission system is built closed. Everything must be consciously opened. This is the opposite of most systems that open everything and ask admins to lock things down. Closed by default is the secure approach. TRUTH #166 — Signup and onboarding flow for new businesses [IMPORTANT] STEP 1 — OWNER SIGNUP: Restaurant owner downloads the app or goes to web app. Signs up — business name, their name, email, location. Signup appears in super admin dashboard as pending approval. Super admin reviews, verifies email, approves. Account activates and owner lands in admin dashboard. STEP 2 — ADMIN INVITES EMPLOYEES: Inside admin dashboard there is an invite section. Admin enters employee first name, last name, email address, and role. System sends email invitation. STEP 3 — EMPLOYEE ACCEPTS: Employee clicks invite link, verifies their email, sets their own password. Immediately routed to employee experience based on their role. STEP 4 — EMPLOYEE ONBOARDING: All published policies assigned automatically. 2 week window to acknowledge all of them. Email and text notifications sent. Single location only for Phase 1. Enterprise multi-location structure — one owner with multiple locations under one account — comes in Phase 2. TRUTH #167 — Test environment — AJs Trailside is live production, separate test location for development [CRITICAL] AJs Trailside Pub — ajstrailsidepub@gmail.com — live production instance. Real data. Real employees. Real policies. Once live the data is clean and protected. New features are not tested here. Test Location — a separate fake business account. Something like Test Co or Demo Restaurant. Tests new features, breaks things intentionally, resets as needed. Completely isolated from AJs Trailside data. No real employees or real policies. Both always visible in super admin dashboard for each app. When testing — launch into Test Location. When operating — log in as AJs Trailside. This pattern applies to every app. Two locations always exist in every super admin dashboard — the real AJs Trailside instance and a test instance. Features proven in test before they touch production data. TRUTH #168 — All apps are designed to be interconnectable — any combination, user controls connections [CRITICAL] Each app works standalone. A business that only needs the HR app gets full value from just the HR app. Nobody is forced to buy the whole suite. When a business uses multiple apps they connect seamlessly. The user controls the connections. They decide which apps to activate and which to connect. Not forced integration. Optional integration that adds value when chosen. APP CATEGORIES: Some apps are universal — any business with employees can use them. HR app is the example. Some apps are business-specific — relevant to businesses receiving deliveries and managing stock. Some apps are industry-specific — built for a specific type but configurable. EVERY APP IS BUILT AS IF IT WILL EVENTUALLY CONNECT: Even if connections are not activated yet the data models are compatible from the start. The employee is the same employee across all apps. The location is the same location. The organization is the same organization. When a user decides to connect two apps the connection works because the foundation supports it. FIRST EXTERNAL BETA USER: A juice and smoothie bar nearby has expressed interest in testing the HR app free of charge. Different food business — no alcohol, different operational profile. This validates whether the platform is truly industry-agnostic or just restaurant-specific dressed up as universal. The platform is industry-agnostic. Restaurant-specific terminology is configuration not architecture. The data model supports retail, hospitality, service businesses, and franchises from the same codebase.

---

PART 15 - DEPLOYMENT STRATEGY AND BUILD STATUS TRUTH #59 — Android-first deployment is the correct sequencing decision [IMPORTANT] Google Play: free to build via Expo, $25 one-time upload fee. Apple App Store: $99 per year developer fee required before any iOS build can be uploaded. Keno app Expo build has passed Android build validation - first deployment milestone achieved. Inventory and HR apps are approximately 80% complete in Cursor. Sequence: Android build and test, then iOS developer account, then iOS build, then App Store submission. TRUTH #60 — Build history informs architecture decisions - prior builds are assets not failures Keno app: 4 builds across 3 platforms before current Cursor build. Inventory app: 2 prior builds. HR app: 1 prior build. Prior platforms: Base44, Replit, Lovable before migration to Cursor. Current Cursor builds are the distilled product of iterative real-world testing. Prior build learnings must be documented in the Cursor architecture audit.

---

PART 18 - APP ARCHITECTURE DECISIONS: WHAT BELONGS TOGETHER TRUTH #79 — The app boundary decision framework: what belongs together vs what gets separated [CRITICAL] Decision criteria for whether a feature belongs in an existing app or needs its own app: • SAME DATA HUB: If the feature reads from and writes to the same primary data store as an existing app, it belongs in that app as a module. • DIFFERENT USER: If the feature is used by a fundamentally different person in a different context, it may need its own app. • DIFFERENT DEVICE CONTEXT: If the feature is used on a different device or in a different physical location, separation may be warranted. • INDEPENDENT VALUE: If the feature has standalone commercial value without requiring the parent app, it can be separated. • SCALE INDEPENDENTLY: If the feature will need to scale at a different rate than the parent app, separate it early. TRUTH #80 — The confirmed app boundary map based on all decisions made to date [CRITICAL] APP 1 - INVENTORY AND FOOD COST (these belong together) • Master Inventory Lists - the hub • Invoice ingestion and AI matching • Ingredients and Recipe Lists with unit conversion • Menu Item Food Cost Records • Kitchen Digital Blueprint - tablet menu view • Portion Control module • Food Cost reporting, alerts, and price change notifications • AI Menu Item and Special Generator - starts here as a module • Menu Engineering matrix and analytics • Multi-vendor intelligence engine - starts here as a reporting layer, may separate later • Ordering master list and order generation APP 2 - KENO, SCRATCH TICKET, AND FINANCIAL TRACKER (separate) • Keno game engine • Scratch ticket sequential audit • Shift deposit reconciliation and Bluetooth printing • Commission tracking • Financial audit trail APP 3 - HR POLICY AND HANDBOOK (separate) • AI policy generation • Employee acknowledgment tracking • Incident reporting and employee files • Training module completion tracking FUTURE FORK CANDIDATES - modules that may become standalone apps • AI Menu Item and Special Generator - if operators want it without full inventory context • Multi-vendor intelligence engine - when it matures beyond a single-location reporting layer • Beverage / alcohol version of App 1 - same architecture, different item catalog The fork decision rule: build modular from day one so any module can be extracted cleanly without rebuilding the core. Do not separate prematurely. Separate when the module has proven standalone value with real users. TRUTH #81 — There can be multiple Master Inventory Lists per vendor - organized however the operator needs [CRITICAL] The Master Inventory List structure is not one list per vendor. It is as many lists per vendor as the operator's operation requires. Lists are categorized however the operator wants. The system suggests organizing by vendor as a default. The operator can override this with any naming or grouping that matches how they actually think about their ordering. AJ's Trailside Pub reference structure (confirmed operational example): • Wohrle's - Spring/Summer (higher par levels: chicken, seafood, produce, lighter items) • Wohrle's - Fall/Winter (tighter par levels: comfort proteins, heavier stocks) • Wohrle's - Year-Round Base (staple items that do not shift seasonally) • Sysco - Standard (Sysco-sourced items, one or multiple lists as needed) • Retail / Miscellaneous (supermarket buys, ad-hoc purchases, low-volume items) The operator activates the relevant list when placing an order. Switching seasons means switching the active list - not rebuilding anything. Items that appear across multiple lists for the same vendor share one price record. Invoice ingestion updates the price once and it propagates to every list that carries that item. Price is never entered in two places. TRUTH #82 — Order Lists live below their parent Master Inventory List and are saved as dated history [CRITICAL] The Master Inventory List is the standing record: what you carry, par levels, current prices. The Order List is generated from it: what you need to order this cycle based on on-hand quantities vs par level. Order Lists are saved beneath their parent Master List as a dated history. They are never deleted. The parent-child structure: • Master List: Wohrle's Spring/Summer ◦ Order List - Mon Mar 16 2026 ◦ Order List - Thu Mar 13 2026 ◦ Order List - Mon Mar 10 2026 ◦ Order List - ... (full history) The ordering workflow from a Master List: • Operator opens the active seasonal Master List • Enters current on-hand quantities for each item (or links to inventory count if already done) • System calculates order quantity: par level minus on-hand equals order amount • Operator reviews, adjusts if needed, confirms • Order List is generated and saved as a dated child of the Master List • Order can be exported as CSV, emailed to vendor, or submitted through vendor app integration The saved Order List history becomes the purchasing audit trail. It shows exactly what was ordered, when, at what price, and from which list. Over time the Order List history reveals purchasing patterns: which items are consistently over-ordered, which always run short before the next delivery, which par levels need seasonal adjustment. TRUTH #83 — Switching between seasonal Master Lists does not change item records - only par levels change [IMPORTANT] When an operator switches from the Spring/Summer list to the Fall/Winter list they are not creating new items. The underlying item records - name, vendor, GTIN, price history, unit conversions - are shared across all lists that carry that item. What changes between seasonal lists: • Par level per item - higher or lower depending on the season's expected volume • Which items are on the active list - some items may only be on the summer list (e.g. seasonal produce) • Order frequency suggestions - some items may be ordered more frequently in peak season What does NOT change between seasonal lists: • Item price records - these come from invoices and are universal • Recipe links - ingredient records link to recipes regardless of which list is active • Food cost calculations - always use the current invoice price regardless of season This architecture means the operator sets up their items once and manages par levels per season - not their entire inventory twice. TRUTH #84 — The Master List is where ordering happens - it is an operational tool not just a reference document [IMPORTANT] The Master Inventory List is not a static price sheet that sits in a database. It is the active workspace where the operator does their ordering at the end of each night. The operator's ordering workflow at AJ's Trailside (confirmed operational pattern): • Late night after service - open the active Master List for tomorrow's vendor • Enter what is currently on hand for each item • System calculates order quantities automatically • Review and adjust for any specials, expected volume changes, or upcoming events • Generate the Order List • Submit or export to vendor This entire workflow must be completable on a phone in under 10 minutes. The UI must be optimized for speed of data entry in a late-night, low-energy context. The operator is tired. They just finished a shift. The app needs to meet them there - fast, simple, tap-tap-done. Any friction in this workflow means the operator skips it, estimates instead, and the ordering accuracy degrades. TRUTH #85 — CORRECTION: One Master List per vendor - par level PROFILES switch, not the list itself [CRITICAL] CORRECTION TO TRUTHS 81-83: Truths 81-83 described multiple Master Lists per vendor (e.g. Wohrle's Spring/Summer list and Wohrle's Fall/Winter list as separate lists). This is architecturally incorrect. The correct model is: ONE Master List per vendor. Par level PROFILES are saved against each item on that list and switched seasonally. The item record never splits or duplicates. The correct data model: • ONE Wohrle's Master List - contains every Wohrle's item, one record each • ONE Sysco Master List - contains every Sysco item, one record each • ONE Retail/Misc List - for ad-hoc and supermarket purchases Each item on a Master List has: ◦ One item record: name, vendor, GTIN, unit, purchase unit, conversion factor ◦ One price record: current invoice price, full price history ◦ Multiple saved par level profiles: Spring/Summer, Fall/Winter, Holiday, Custom, etc. ◦ One active par level profile: whichever season is currently selected The season selector lives at the top of the Master List - one tap switches all par levels simultaneously: ◦ Active Profile: [Spring/Summer] - tap to switch to Fall/Winter, Holiday, or custom ◦ Switching profile updates every item's target quantity instantly ◦ No items move. No prices change. Only the ordering targets adjust. Chicken breast is ONE record on the Wohrle's Master List. It does not split into a spring chicken breast and a winter chicken breast. The invoice updates the price on that one record and it is correct everywhere immediately. The par level profile determines how much to order. The item record determines what it costs. These are two separate concerns stored separately. They must never be conflated in the data model. TRUTH #86 — Par level profiles are named, saved, and reusable - they are a first-class data object [CRITICAL] A par level profile is not just a setting. It is a named configuration object that the operator creates, saves, and reactivates. Profile structure: • Profile name: operator-defined (Spring/Summer, Fall/Winter, Holiday Week, Adams Fair Week, etc.) • Per-item par level: the target quantity for each item in this profile • Created date and last modified date • Notes: optional operator notes about when this profile applies AJ's Trailside confirmed profiles: ◦ Spring/Summer: higher chicken, more seafood, more produce - runs roughly April through September ◦ Fall/Winter: tighter chicken, heavier beef and comfort items - runs October through March ◦ Custom profiles can be created for events: Adams Fair, holidays, private party weeks The operator can create as many profiles as they need. There is no limit. Profiles make seasonal transitions a one-tap operation instead of a manual re-entry session. A new operator who has never thought about seasonal par levels can start with one default profile and add seasonal profiles as they learn their own patterns. TRUTH #87 — Invoice price updates the item record on the Master List - never the par level profile [CRITICAL] When a Wohrle's invoice is ingested and chicken breast shows $1.80/lb instead of $1.75/lb: • The item record on the Wohrle's Master List updates to $1.80/lb • The price history logs the change: date, old price, new price, invoice reference • Every recipe that uses chicken breast recalculates food cost automatically • Every menu item that uses those recipes recalculates food cost % automatically • The RED price change flag appears on the chicken breast record • If the new price pushes any menu item above the food cost threshold an alert fires None of this touches the par level profiles. Par levels are unaffected by price changes. Price lives on the item record. Quantity targets live on the par level profile. These two data concerns are completely independent. A price change never affects how much you order. A par level change never affects what you pay.

---

PART 20 - WHY THIS PLATFORM EXISTS: THE MARKET GAP TRUTH #93 — This platform was built because no affordable connected system exists for small restaurant operators [CRITICAL] The existing market offers two options: expensive enterprise suites with features most small operators will never use, or disconnected point solutions that each solve one problem but don't talk to each other. The enterprise suites (Toast, Ctuit, Restaurant365, Compeat) require demos, contracts, implementation fees, and ongoing support costs that are out of reach for a single-location operator doing $1-1.5M annually. The point solutions each do their job reasonably well in isolation: • 7shifts: scheduling and labor management - integrates with Spot On POS, tiered pricing, mobile-first • 7tasks: task list management - integrated with 7shifts, photo verification, role and time-based assignment • PrepWizard: prep label printing - Bluetooth thermal printer, dissolvable labels, geo-fenced location, $10/month • Spot On POS: point of sale, labor tracking, sales reporting - the data source everything else needs The problem: none of them talk to each other in the ways the operator actually needs. Each one is an island. The operator is the integration layer — manually moving information between systems, re-entering data, filling gaps with memory and intuition. This platform exists to replace the operator as the integration layer. The systems talk to each other. The operator makes decisions. That is the only division of labor that works when one person is running everything. TRUTH #94 — The Spot On API integration is the correct long-term path - not workarounds through third parties [IMPORTANT] Spot On POS is the source of truth for sales data, clock-in/clock-out, and transaction history. Connecting to Spot On through 7shifts is a workaround — it gives partial data access with someone else's permissions and someone else's rate limits. The correct path: once the app is in the App Store and legitimate, apply directly to Spot On for API access. Official integration gives full data access, stable connection, and proper authentication. The 7shifts connection was built to test the foundation and understand the data flow. That was the right call. It was not abandoned — it was correctly paused until the proper integration path is available. Do not invest further engineering effort in the 7shifts-to-Spot On workaround. Build toward the official Spot On API integration as the production solution. The same applies to any third-party integration: always prefer official API access over workarounds. Workarounds break when the third party changes their system.

---

PART 24 - THE UNIVERSAL AUDIT LOG TRUTH #106 — Every action across every app generates a timestamped audit log entry - no exceptions [CRITICAL] Every meaningful action in the platform is a timestamped event. Not just financial transactions. Everything. Every app contributes to the same audit log infrastructure: • Inventory app: delivery received, invoice scanned, price updated, item added, par level changed, order generated, order submitted • Prep and cooler: prep label printed, reprint flagged, red dot marked, yellow dot marked, morning photo taken, cooler check completed • Waste log: item wasted, quantity, cost, reason, employee • Task module: task assigned, task completed, photo verification submitted, task failed, checklist signed off • Kitchen app: recipe viewed, portion spec accessed, digital menu accessed • Food cost app: recipe saved, food cost calculated, menu item price changed, alert acknowledged • POS feed: every sale, every item sold, every void, every discount, every clock-in and clock-out • Keno and financial: every shift started, every ticket logged, every deposit finalized, every discrepancy flagged • HR app: policy published, policy acknowledged, incident filed, warning issued, employee added The audit log is not a feature. It is the foundation of the entire platform's trustworthiness. Every record that can be disputed, every action that has accountability implications, every data point that drives a business decision must have a timestamp, a user ID, and a record of what changed. TRUTH #107 — The connected audit log turns the operation into a documented science [CRITICAL] When all timestamps are connected across all apps the entire operation becomes readable as a timeline. Example — one ingredient, one day, fully documented: • 07:14am — Delivery received, Wohrle's invoice scanned, 40 lbs chicken breast at $1.75/lb logged • 07:31am — Morning inventory check completed, cooler photos taken, no red dots on chicken • 08:45am — Prep label printed, 12 lbs chicken tenders, Employee: Maria • 09:02am — Prep label printed, 8 lbs grilled chicken, Employee: Maria • 11:23am — Boneless Wings sold, 3 orders, POS feed • 12:14pm — Chicken Tenders sold, 6 orders, POS feed • 02:38pm — Waste log entry, 2 lbs grilled chicken overprepped, Employee: Jake, cost: $3.50 • 05:47pm — Chicken Wings 10pc sold, 14 orders, POS feed • 09:12pm — Closing task completed, cooler check, photo verified by Sarah • 10:44pm — Order list generated, 3 cases chicken added to Wohrle's order That is one ingredient on one day. The system knows exactly what came in, who prepped it, how much was made, how much sold, how much wasted, and what was ordered for tomorrow. No guesswork. No end-of-week surprises. No 'I think we went through about three cases' — the record shows exactly what happened. Stack 365 days of this data and the operation runs itself. Par levels self-calibrate. Waste patterns surface. Prep volumes align to actual sales. Ordering becomes precise. TRUTH #108 — The audit log provides legal and operational protection across four distinct scenarios [CRITICAL] VENDOR BILLING DISPUTES: • Vendor claims 50 lbs delivered. Invoice ingestion logged 40 lbs received at time of delivery. • Delivery photo is timestamped and in the system. • That is a billing dispute resolved in the operator's favor with documentation. EMPLOYEE ACCOUNTABILITY: • Employee claims they completed the cooler check. Photo verification timestamp shows it was done 45 minutes after close — after they had already clocked out. • That is a performance record with documented evidence. • Employee disputes a disciplinary action. The HR app shows every policy they acknowledged, every task they completed or missed, every incident logged against them. • Nothing is he-said-she-said. Everything is timestamped. FOOD SAFETY AND HEALTH INSPECTION: • Health inspector asks about FIFO rotation practices. • Every prep label has a timestamp and expiration date. Every red dot was logged in the morning check. The waste log shows what was discarded and when. • That is documentation most small restaurants cannot produce. The platform produces it automatically. THEFT AND UNEXPLAINED LOSS: • Inventory variance shows 5 lbs of shrimp unaccounted for between receiving and sales. • Audit log shows: received at 10am by employee A, prep label printed at 2pm by employee B, no waste log entry, no sale that accounts for the missing quantity. • That narrows the accountability window to a specific time range and a specific set of people. The audit log does not replace judgment. It informs it. The owner still makes the decision. But the decision is made with documented evidence rather than gut feeling. TRUTH #109 — Audit log records are immutable - they can be annotated but never deleted or altered [CRITICAL] Every audit log entry is permanent. It can be annotated with a note or explanation. It cannot be edited or deleted. If a record was entered incorrectly a correction record is created alongside the original. The original remains visible. The correction is logged with who made it and when. This is the same soft-delete architecture established in Truth #53 for the Keno app - it applies platform-wide to all audit log records across all apps. The audit log is only valuable if it is trustworthy. A log that can be edited or deleted is not a log - it is a suggestion. Every audit log record must have: entry_id, business_id, location_id, user_id, action_type, entity_type, entity_id, old_value, new_value, timestamp, ip_address or device_id, app_source. These fields are non-negotiable. Every app that writes to the audit log must supply all of them. No partial records. TRUTH #110 — The owner can see the entire operation in real time from anywhere - this is the remote visibility promise [CRITICAL] The audit log combined with photo documentation means the owner can see the state of the operation from a phone without being physically present. What is visible remotely at any moment: • Whether the morning inventory check was completed and when • Daily cooler and dry storage photos from this morning • What is red-dotted and needs to move today • What was prepped today, by whom, and how much • Current sales from the POS feed • Whether closing tasks are being completed and photo-verified • Any waste logged today and the running cost • Whether the Keno drop has been reconciled • Any HR incidents or task failures flagged today This is not a dashboard of lagging indicators reviewed at the end of the week. This is a live operational view updated continuously throughout the day. For a single operator running a restaurant, raising kids, managing logistics, and building software at midnight - this is the difference between being tethered to the physical location and being genuinely free to operate remotely when needed. The audit log is not just about accountability. It is about freedom. When the system documents everything automatically, the operator does not have to be there to know what is happening.

---

-e 


# OPERATIONAL PHILOSOPHY

**Scope:** These are the founding operational principles that drive every design decision across all apps. Not app-specific but essential context for understanding WHY features are built the way they are.

---

PART 26 - THE FOUNDING OPERATIONAL PHILOSOPHY TRUTH #118 — You cannot fix a restaurant by fixing employees one at a time - you fix it by building the system [CRITICAL] The employee-by-employee fix loop is a trap every restaurant operator knows. Fix one person, another slips. Plug one hole, another opens. Implement side work sheets, someone throws them in the trash. The operator never gets ahead because they are always reacting. The only exit from the loop is to stop trying to fix individual behavior and start building the system that makes the right behavior the default, makes accountability automatic, and makes the consequences of not following through visible and documented. This is not a theory. It is the operational conclusion reached after years of running a restaurant, trying every version of the individual fix, and watching each one fail not because the employees were bad people but because there was no system holding any of it in place. Every feature in this platform exists because the manual version of that feature was tried, worked when someone was watching, and failed the moment the watching stopped. The platform is not a replacement for good employees. It is the structure that makes good employees visible and makes accountability unavoidable for everyone including management. TRUTH #119 — The operator's job is to build sustainable systems - not to be physically present filling every gap [CRITICAL] The shift in role that makes this operation viable long term: • Before: operator jumps into every position as needed — dishwasher, line cook, manager, cashier, closer. Everyone is comfortable with this. The operation depends on it. • After: operator focuses on food cost, menu engineering, pricing, vendor relationships, systems, and the things that determine whether the business survives and grows. The system handles the gaps. This shift is invisible to employees in the short term. It looks like the operator is doing less. It is actually the most important work the operator has ever done for the business. The message delivered to the team: we will not survive unless I do this. What I am doing right now is something substantial that needs to be done. It is hard to see. Trust the process. Every dollar matters. We are at the next level now and the next level requires different things from me. Instant gratification is the enemy of sustainable operations. The system being built right now will not show results this week. It will show results over months and years as food cost tightens, waste decreases, accountability compounds, and the operation runs more efficiently every single week. The operator who stops backtracking on the day-to-day noise and focuses on the foundational work is making the correct long-term decision even when it feels wrong in the short term. TRUTH #120 — Structured accountability is not punitive - it is fair to everyone including the employees [CRITICAL] Employees operating without clear guidelines, without documented expectations, and without consistent enforcement are set up to fail. When they fall short the operator has no documented basis for accountability and the employees have no clear understanding of what was expected. That is not fair to the operator. But it is also not fair to the employees. Structured accountability through the platform creates fairness in both directions: • Employees know exactly what is expected of them — it is written in the handbook they acknowledged • The system tracks whether expectations are being met consistently and without favoritism • Good employees who do their job are never questioned — the system confirms their performance automatically • Employees who are falling short are shown the data — not accused based on someone's impression • The operator has documented evidence for every performance conversation — nothing is he-said-she-said An employee who understands the system and works within it has nothing to fear from it. The system only becomes visible to an employee when their behavior does not match what they agreed to when they signed the handbook. This is the standard that makes it possible to eventually bring in a floor manager or kitchen lead with confidence — because the systems exist to train them, measure them, and hold them accountable without the operator having to be physically present every hour. TRUTH #121 — The smaller rotating menu is a strategic direction that the platform must support [IMPORTANT] The current menu is large. The kitchen is small — two fryers, limited line space, tiny footprint. During peak summer patio season a large menu slows table turns because execution time per ticket increases with menu complexity. The strategic direction: a smaller rotating menu that changes more frequently. What this requires from the platform: • Rapid item activation and deactivation — turning items on and off the active menu cleanly in Spot On and in the food cost system simultaneously • Cost validation before a new item goes live — the operator must know what a new rotating item costs before it hits the specials board, not after • The AI generator supports this directly — generate a new item, cost it instantly against current ingredient prices, validate margin before committing • Table turn time as a constraint in the generator — items recommended for peak patio season must execute within the time window that supports fast turns • Price auto-update when ingredient costs change — a rotating menu item is only viable if its margin holds when haddock spikes or beef goes up The smaller rotating menu is also a food cost tool. Fewer SKUs means less inventory to carry, less waste exposure, and faster prep cycles. The kitchen can execute fewer items at higher volume more efficiently than many items at lower volume. TRUTH #122 — Liquor inventory requires the same per-bottle precision as food inventory - over-pouring and theft are margin leaks [IMPORTANT] General liquor inventory — overall levels by category — is not sufficient to detect over-pouring or theft. What is required: specific by-bottle tracking. What came in, what the POS says went out, what is physically on the shelf. The variance between those three numbers tells you exactly what is unaccounted for. The beverage version of App 1 is the same architecture applied to a different item catalog: • Bottles received via invoice ingestion — same photo and AI line item extraction • POS feed tracks what was sold — same Spot On integration • Physical count entered weekly — same on-hand quantity entry • Variance calculated: received minus sold minus on-hand equals unexplained loss • Over-pouring shows as consistent small variances across high-volume bottles • Theft shows as larger discrete variances that do not correlate with sales patterns Weekly liquor variance reporting at the bottle level is a significant management tool that most small operators do not have. The platform provides it using the same infrastructure already built for food. This is one of the fork candidates identified in Truth 80 — the beverage version of App 1 is the same system with a different item catalog. Building food first proves the architecture. Beverage follows the same pattern. TRUTH #123 — The floor manager hire becomes viable once the platform foundations are in place - not before [IMPORTANT] The staffing gap: the operator cannot be physically present during active service hours because every hour spent on the floor is an hour not spent on the foundational work that determines long-term survival. The person needed is not a traditional general manager. The profile is specific: • Restaurant experience — knows how the industry works, can read a room, earns employee respect naturally • Trusted floor presence during active service — the face employees interact with, the person handling day-to-day situations • Does not need to do food ordering, food cost analysis, or backend operations — the platform handles all of that • 20-40 hours per week flexible — not required every Friday and Saturday, a rotation of busy days and midweek coverage • Potential profile: semi-retired restaurant industry veteran who wants meaningful part-time work without the full pressure of managing a restaurant Why the platform must come first: • Without the systems in place there is nothing to hand off — the operation runs on institutional memory and the operator's personal knowledge • With the systems in place the handoff is clean — here is the kitchen Bible, here is the task system, here is what I see remotely, here is what I need you to handle on the floor • The manager succeeds because the system tells them what good looks like and confirms whether it is happening The foundation-first approach is not perfectionism or delay. It is the only hiring strategy that gives the floor manager a real chance to succeed and gives the operator a real way to verify they are succeeding. Every dollar invested in building the platform before hiring is worth more than the same dollar spent on a manager who walks into an operation without systems and either burns out trying to hold it together manually or stops trying and collects a paycheck.

---

-e 


# APP 3 — HR POLICY & HANDBOOK (PolicyVault)

**Scope:** These truths apply specifically to App 3. This app is architecturally independent — no confirmed connection to the Inventory Core.

**Last Updated:** March 17, 2026 — After fix cycle. All critical and high priority fixes applied. Health rating estimated: 8.5+/10.

---

## PART 13 - HR POLICY AND HANDBOOK SYSTEM (App 3) - VERIFIED AND EXPANDED

TRUTH #55 — App 3 is a mini HR department for small businesses who cannot afford one [CRITICAL]

A small restaurant owner who cannot afford an HR department gets one inside this app. The app does what an HR department does — generates policies, tracks compliance, documents incidents, maintains employee files, creates the paper trail that protects the business legally.

THREE CORE PURPOSES: Policy generation using AI. Legally defensible acknowledgment tracking. Security audit trail.

That is the whole app. It does not do payroll, benefits, recruiting, or performance reviews. The target user is a growing small business owner who is past the point where informal management works but cannot yet afford formal HR. The app does not replace human judgment. It gives judgment a record.

**STATUS:** All three core purposes confirmed working ✅ — real Claude API integration with web search for policy generation, SHA-256 content hash for acknowledgments, system_events + amendments for audit trail.

---

TRUTH #56 — The employee file is the digital folder that cannot be lost altered or conveniently misplaced [CRITICAL]

Every employee has a file containing: all policy acknowledgments with timestamps, write-ups, verbal warnings, written warnings, final warnings, incident reports, commendations, internal admin notes, training completion records, certifications, and uploaded documents.

TERMINATION: Access revoked immediately. File preserved permanently. Re-hire — no clean slate, previous file carries forward.

RECORD EXPORT: Admin can generate and export complete file for any employee including terminated employees.

**STATUS:**
- Policy acknowledgments with timestamps: ✅
- Write-ups with severity/discipline levels: ✅
- Incident reports: ✅
- Record export: ✅
- File preserved permanently (no hard delete): ✅
- Terminated employee access revocation: ✅ VERIFIED — login requires status='active' and deleted_at IS NULL
- Re-hire carryforward: ✅ VERIFIED — terminate only sets status, same employee_id keeps all records linked
- Commendation as HR record type: ✅ VERIFIED — accepted by HR_RECORD_TYPES validation
- Internal admin notes: ✅ VERIFIED — internal_note is a valid record type, hidden from employee

**REMAINING GAPS:**
- Training completion records: NOT BUILT — no training module in codebase
- Certifications tracking: NOT BUILT — no certification records found

---

TRUTH #152 — App 3 has four content types with different rules security levels and visibility [CRITICAL]

POLICIES — formal, acknowledged with individual signature, SHA-256 content hash, version controlled, legally defensible.
HANDBOOK — organized collection of published policies by category. Dynamic, never locked, can be reorganized.
JOB ROLE DEFINITIONS — position expectations acknowledged at hire. Lives in handbook under Roles and Responsibilities.
EMPLOYEE FILE — complete record for each person.

CHECKLIST RULE: Checklist item = task module. Not a checklist item = HR app. Write-up can reference task failure as evidence but the write-up lives in the HR app.

**STATUS:** Aligned ✅. All four content types confirmed in codebase.

---

TRUTH #153 — The guided handbook generator works in phases with minimum input and maximum output [CRITICAL]

REQUIRED MINIMUM: Business name, industry, state. State is required before anything is generated — even universal policies are not truly universal once state law is factored in.

PHASE 1: Short form, AI generates recommended policy list state-aware and industry-aware with web research enabled, user selects which to include, AI generates full content, hybrid category system, everything lands in draft.
PHASE 2: More guided questions, more general business policies, user picks, AI generates, connects to gap audit.
PHASE 3: More specific — location-specific, role-specific, industry-specific deeper policies. Phase 2 questions designed after Phase 1 is working in real world.

**STATUS:** Phase 1 implemented ✅. organizations.state in schema. Claude web search enabled for all policy generation. AI handbook-recommend and handbook-generate-selected routes working. Phase 2 and 3 designed after Phase 1 works in production (expected).

---

TRUTH #154 — AI policy generation uses web research and must produce non-redundant output [CRITICAL]

Web research enabled for all policy generation calls. AI researches current law and current standards — not training data alone.

THE REDUNDANCY FIX: Use low temperature (0.1-0.2) and explicit prompt instructions to reduce redundancy. Multi-pass for handbook — generate titles first, expand each individually. Cosine similarity validation — if new policy more than 80 percent similar to existing policy flag and retry.

NOTE: frequency_penalty does not exist in the Claude API. Claude supports temperature, top_k, and top_p only. Current implementation uses temperature 0.1-0.2 (correct approach).

**STATUS:** ✅ FIXED. Claude web search (web_search_20250305 tool, max_uses: 5) is enabled in ALL Claude calls in server/lib/claude.js: streamPolicyGeneration, scanHandbookMissing, extractPoliciesFromHandbook, handbookRecommend, policySuggest, generateComplianceChecklist, verifyComplianceChecklist.

---

TRUTH #155 — Policy draft screen — editing AI assistance version control and publishing [IMPORTANT]

AI PROMPT BOX: Admin types plain language instruction. AI shows suggested change in before/after comparison. Admin accepts or rejects. Never applies automatically.
AUTO-SAVE: Debounced, visual indicator. Manual save button also available. Forward/back buttons for full undo/redo.
AUDIT LOG STARTS AT DRAFT: Every change logged even before publish.
THREE PUBLISHING OPTIONS: Individual. Bulk select. Publish all. Filtering before publish. Soft confirmation before any publish action.
Acknowledgment window configurable at three levels: platform default, business default, per-publish event override.

**STATUS:** AI prompt box ✅ (ai/policy-suggest). Audit log at draft ✅. Disclaimer on policy editor when draft content present ✅.

---

TRUTH #156 — Policy targeting — default is all employees restriction is the deliberate choice [CRITICAL]

DEFAULT: All employees. No setup. The legally safe default.
ALCOHOL POLICY RULE: Everyone acknowledges alcohol policy regardless of role.
NEW EMPLOYEE RULE: All published policies assigned at onboarding regardless of when published.

**STATUS:** Aligned ✅.

---

TRUTH #157 — Acknowledgment windows configurable at three levels [CRITICAL]

Platform default: 2 weeks new employees, 1 week policy updates. Business default overrides platform. Per-publish event overrides business default — pre-fills with business default.

ENFORCEMENT: Reminders and admin notifications only. No lockout. Human conversation. Extension logged.

**STATUS:** ✅ VERIFIED. Three tiers working: PLATFORM_DEFAULT_ACK_WINDOW_NEW_DAYS = 14, PLATFORM_DEFAULT_ACK_WINDOW_UPDATE_DAYS = 7. Business default from org.settings. Per-publish override via due_date.

---

TRUTH #158 — Individual policy acknowledgment requires signature-equivalent confirmation per policy [CRITICAL]

NOT a single checkbox for whole handbook. Each policy gets its own acknowledgment. Email and text notifications sent. Both channels. Email verification is the first link in the legal defensibility chain.

**STATUS:** Individual acknowledgments with SHA-256 hash ✅. Email notifications ✅.

**REMAINING GAPS:**
- SMS/text notifications: NOT BUILT — employees table has sms_reminders column but no SMS sending code exists
- Email verification before first login: NOT BUILT — no verification flow in codebase. This is a gap for legal defensibility.

---

TRUTH #159 — Progressive discipline structure — five record types with different formality levels [CRITICAL]

INTERNAL NOTE — private, never shown to employee, no sign-off, quick entry.
VERBAL WARNING — shown to employee, optional sign-off conversation happened, lightweight.
WRITTEN WARNING — employee acknowledges receipt, formal record.
FINAL WARNING — employee signs, locked after period, permanent.
IMMEDIATE TERMINATION — own record type, immutable immediately, highest security.
COMMENDATION — positive record, shown to employee, admin can turn on/off, default on.

**STATUS:** ✅ VERIFIED. All six types validated in HR_RECORD_TYPES (internal_note, verbal_warning, written_warning, final_warning, immediate_termination, commendation). Legacy write_up normalized to written_warning. Immediate termination sets is_locked=1 on create.

**REMAINING GAP:** Commendation admin visibility toggle (show/hide, default on) not implemented. Only internal_note is hidden from employee view.

---

TRUTH #160 — Incident reports have strict confidentiality rules that cannot be overridden [CRITICAL]

Subject of incident report never sees it, is never notified, has no visibility. Ever. Hard rule. No toggle.

**STATUS:** ✅ FIXED AND VERIFIED. incident-reports route filters out reports where employee_id matches the current user. secure-incident-write returns 403 if subject tries to update notes/attachments. Only admin or manage_incidents can update.

---

TRUTH #161 — Three paths for policy creation beyond the guided handbook generator [IMPORTANT]

PATH 1 — GENERATE SPECIFIC POLICY: AI prompt box, admin types conversationally, AI generates and categorizes.
PATH 2 — SCAN FOR MISSING POLICIES: AI reviews handbook, returns 4-6 missing policies, admin picks one, provides info, AI generates.
PATH 3 — UPLOAD EXISTING HANDBOOK: Upload in any format, AI extracts policies, imports categorized and organized.

**STATUS:** Aligned ✅. All three paths confirmed: ai/generate-policy, ai/scan-handbook-missing, ai/extract-handbook.

---

TRUTH #162 — Compliance checklist is state and industry generated — separate from handbook [CRITICAL]

Generated dynamically based on state entered at setup. Each item has: requirement stated plainly, suggested answers, confirmation field.

DISTINCTION: Gap audit scans handbook for missing policies. Compliance checklist confirms business is actually doing what law requires beyond having a policy.

**STATUS:** ✅ REBUILT. See new Truth #176 for the full state-agnostic compliance architecture.

---

TRUTH #163 — Massachusetts compliance checklist items confirmed for restaurant businesses [IMPORTANT]

This truth documents AJ's Trailside Pub specific compliance requirements as a REFERENCE EXAMPLE. The system does NOT hardcode Massachusetts or restaurant-specific items. See Truth #176 — the compliance system dynamically generates state-specific requirements for ANY state using Claude + web search. Massachusetts items documented here serve as a validation baseline for the AI-generated output for MA businesses.

---

TRUTH #164 — Terminated and inactive employee handling [CRITICAL]

ACCESS REVOKED: Immediately. Hard rule. No grace period.
FILE PRESERVED: Permanently. Nothing deleted. Admin sees complete file indefinitely.
RE-HIRE: No clean slate. Previous file carries forward.

**STATUS:** ✅ VERIFIED. Login requires status='active' and deleted_at IS NULL. Terminate sets status only — same employee_id keeps all acknowledgments, hr_records, and incident_reports linked. Export and employee-profile intentionally allow viewing terminated records.

---

## NEW TRUTHS FROM POST-OVERHAUL AUDIT AND FIX CYCLE (March 2026)

---

TRUTH #172 — Web client uses cookie-only authentication — no JWT in localStorage [CRITICAL]

The web client (Handbook Policy App) uses httpOnly cookie auth exclusively. No JWT is stored in or read from localStorage anywhere on the web client.

- Server sets httpOnly cookie (pv_access_token) on login/refresh for web clients
- Cookie is secure in production, sameSite strict, 15-minute maxAge
- Web client uses credentials: 'include' to send cookie automatically
- CSRF protection via double-submit cookie pattern (pv_csrf_token cookie + X-CSRF-Token header)
- Base44 app-params path cleaned — access_token is URL-only for that page load, never persisted to localStorage
- On each page load, any legacy base44_access_token and token keys are removed from localStorage

Mobile (PolicyVaultExpo) uses expo-secure-store with Bearer tokens. Auth middleware checks cookie first, then Bearer.

**STATUS:** ✅ COMPLETE. localStorage JWT fully removed. Cookie-only auth for web.

---

TRUTH #173 — Refresh token rotation with reuse detection prevents token theft [CRITICAL]

Refresh tokens stored with SHA-256 hash. Old token marked used on each refresh. New tokens issued. Reuse detection revokes all sessions for that user. Access tokens expire 15 minutes.

**STATUS:** ✅ Implemented.

---

TRUTH #174 — CSRF protection uses double-submit cookie pattern [IMPORTANT]

State-changing methods require pv_csrf_token cookie + X-CSRF-Token header match. Skipped for GET/HEAD/OPTIONS and Bearer-only (mobile).

**STATUS:** ✅ Implemented.

---

TRUTH #175 — Expo app exists as a separate frontend — architectural decision pending [IMPORTANT]

PolicyVaultExpo (Expo SDK 55, Expo Router) has ~8 screens vs 30 on web. Decision needed: consolidate on Expo for web+mobile or maintain both.

**STATUS:** Decision pending.

---

TRUTH #176 — Compliance system is state-agnostic and AI-driven — not hardcoded for any state [CRITICAL]

The compliance system generates requirements dynamically for ANY state based on the business's state and employee count. It does NOT rely on a static database of state-specific compliance items.

ARCHITECTURE:
- Federal baseline (7 items) is hardcoded — applies to ALL employers in ALL states: EEO/Title VII, ADA, FLSA, OSHA, I-9, anti-harassment/discrimination, at-will employment
- State-specific requirements are generated by Claude with web search enabled when the user enters their state and employee count
- Claude searches authoritative .gov sources, state labor departments, official statutes
- Each requirement includes: requirement text, statute citation, source URL, required vs recommended, employee threshold, category
- Results saved to compliance_checklist_items with source_citation, source_url, researched_at, verified_at, verification_status
- organizations.employee_count stores the business size for threshold-based law filtering

PERIODIC VERIFICATION:
- POST /api/compliance-checklist/verify re-checks source citations via Claude + web search
- Compares against original_requirement_text (not the admin's edited display version)
- Updates verification_status: current / needs_review / changed / outdated
- Updates verified_at timestamp
- Admin can trigger manually anytime; scheduled verification is a future enhancement

**STATUS:** ✅ Implemented. Federal baseline seeded. State-specific generation via Claude + web search working. Verification route working.

---

TRUTH #177 — Legal content and business policy content are separated visually and architecturally [CRITICAL]

LEGAL REQUIREMENTS: Federal and state law sourced from statutes. Generated by AI with citations. Admin did not write these.
BUSINESS POLICIES: Admin's own policies for how they run their business. Admin writes, edits, publishes these. Employees acknowledge these.

These two types of content are:
- Visually distinct in the UI (legal content has amber border/background, "Legal requirement (sourced)" label with scale icon)
- Stored separately (legal in compliance_checklist_items with citations; business policies in policies table)
- Never intertwined in the same editable field

**STATUS:** ✅ Implemented in compliance checklist UI. Full structural separation within individual policy editor (legal block vs business block within a single policy) is a future enhancement.

---

TRUTH #178 — Sourced legal content preserves the original — display version is editable with tracking [CRITICAL]

When legal content is generated from AI + web search:
- original_requirement_text and original_suggested_answer store the exact sourced text (never modified)
- requirement_text and suggested_answer are the editable display versions
- Admin can edit the display version to fix formatting, remove web scraping garbage, adjust spacing
- When display differs from original, a banner shows: "This is sourced legal content. Edits are tracked."
- "View original" button shows the unmodified sourced version
- "Restore original" button reverts display to original
- All edits logged in audit trail (system_events) via logAudit
- Periodic verification (POST /compliance-checklist/verify) compares against original_requirement_text, not the admin's edits

**STATUS:** ✅ Implemented. Dual content fields, edit tracking, view/restore original, audit logging all working.

---

TRUTH #179 — AI-generated legal content carries an honest disclaimer [IMPORTANT]

Every compliance checklist and every AI-generated policy that references laws displays:

"Policies are generated from current state and federal law with source citations. For questions about how a specific law applies to your unique business situation, consult a licensed attorney."

This disclaimer:
- Appears on compliance checklist page and policy editor when draft content is present
- Does NOT appear on business policies the admin wrote themselves
- Is short and honest — does not scare the user or tell them they must hire a lawyer before using the app
- Does NOT claim the output is legal advice

**STATUS:** ✅ Implemented on compliance checklist and policy editor.

---

## REMAINING GAPS — PRIORITIZED

### COMPLETED (no longer gaps)
- **Email verification before first login** — NOW COMPLETE. email_verified_at, verification tokens, login gate, resend flow, VerifyEmail page all implemented.
- **Document upload for employee files** — NOW COMPLETE. employee_documents table, multer upload, UUID storage, download/list/delete routes, EmployeeProfile documents tab.
- **Commendation admin visibility toggle** — NOW COMPLETE. visible_to_employee column on hr_records, toggle in UI for commendations only, audit logged via amendments.

### REMAINING GAPS
1. **SMS notifications** — Truth #158 requires email AND text. Deferred; email is sufficient for beta.
2. **Training/certifications module** — Truth #56 lists these in the employee file. Future enhancement; requires new tables and module.

### LOW (Future improvement)
7. **Claude cost governance** — No per-org or per-user rate limit or token budget for AI calls.
8. **Migration versioning** — No schema_version table for SQLite.
9. **CI/CD pipeline** — No automated testing, building, or deployment.
10. **Monitoring and error tracking** — No Sentry or equivalent.
11. **Expo feature parity** — PolicyVaultExpo has ~8 screens vs 30 on web.
12. **Full legal/business block separation within policy editor** — Currently only compliance checklist has clean separation. Individual policy editor shows disclaimer but doesn't structurally separate legal from business content within a single policy.
13. **Scheduled compliance verification** — Currently manual trigger only. Future: 30/60/90 day automated re-verification.
14. **Backup search engine for compliance** — Currently depends on Claude web search only. Future: fallback search if Claude is unavailable.
