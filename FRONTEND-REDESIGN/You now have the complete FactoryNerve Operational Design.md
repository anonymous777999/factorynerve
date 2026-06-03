FactoryNerve Operational Design Doctrine
Version 1.0 — Classified: Internal Design Law Authored by: Senior Operational UX Architecture

SECTION 1 — OPERATIONAL LANGUAGE SYSTEM
1.1 Terminology Replacement Table
The language of a system trains the mental model of its users. When operators read words borrowed from military operations centers or science fiction control rooms, their nervous system responds accordingly — with heightened alertness, a sense of crisis proximity, and cognitive load that compounds over an eight-hour shift. FactoryNerve must speak the language of the factory floor, not the language of a war room. Every word must feel like it belongs in a production meeting, not a tactical briefing.

The following replacements are mandatory. No exceptions for "it sounds cooler" or "it feels more technical." Cool is irrelevant. Operational clarity is everything.

BANNED TERM	APPROVED REPLACEMENT
Anomaly	Variation
Signal	Reading
Telemetry	Equipment data
Node status	Station condition
Operational zone	Production area
Command matrix	Work assignments
System pulse	Production rhythm
Tactical feed	Activity summary
Live telemetry	Current readings
Threat level	Concern level
Mission critical	Priority
Zone integrity	Area status
Alert cascade	Escalating concern
Data stream	Incoming readings
Neural network output	Recommendation
Predictive engine	Forecast
Fault signature	Issue pattern
Incident vector	Problem source
Operational tempo	Production pace
Real-time intelligence	Current overview
Threat response	Corrective action
System heartbeat	Status check
The banned list is not exhaustive. The test is simple: would a supervisor on the floor use this word in a sentence to a line operator? If not, it does not belong in the interface.

1.2 Voice Registers
FactoryNerve speaks in three registers. These are not severity levels. They are modes of communication calibrated to the operator's current need for attention. The system speaks less the more normal things are. It earns the right to interrupt.

AMBIENT — No action required
Tone: Quiet. Confirmatory. The system is functioning as expected and the interface communicates this through restraint, not through reassurance. Ambient copy does not congratulate the operator for things working correctly. It simply confirms that the current state is within expectation.

Sentence structure: Short declarative statements with no imperative verbs. No exclamation. No urgency markers. Present tense only. Avoid compound sentences. The subject is always the system state, never the operator's required response.

Rules:

Never use words like "running smoothly," "all clear," or "no issues detected." These phrases communicate absence of a problem, which still invokes the concept of a problem. Instead, state the positive condition directly.
Passive phrasing is acceptable and often preferable in ambient register. "Line 3 operating at planned rate" is correct. "Line 3 is performing normally" implies that abnormal performance is a meaningful baseline to compare against.
Maximum 8 words per ambient label. If it takes more than 8 words to describe an ambient state, the state description is wrong, not the word limit.
Example:

Line 3 — 412 units completed. Pace on schedule.

NOTABLE — Something has changed
Tone: Informational. Steady. The system has observed a change and is reporting it without editorial. Notable copy never implies danger and never implies the operator failed to notice something. It is a factual update, delivered with the assumption that the operator is competent and will decide what to do.

Sentence structure: Subject + verb + specific detail. The detail must be quantified wherever possible. Avoid vague qualifiers like "some," "slightly," or "a few." If the reading changed by 4%, say 4%. If two workers are unassigned, say 2 workers. The specificity is the tone.

Rules:

Notable copy must state what changed, not what it might mean. Interpretation belongs to the operator, not the interface. "Output rate decreased 7% in the last 30 minutes" is notable copy. "Output rate may indicate a developing issue" is not.
Notable copy may include a soft directional cue — a single follow-up fact that helps the operator orient — but it must not recommend action. "Shift 2 output is 7% below pace. Last comparable Thursday: on pace." This is acceptable. "Consider reviewing Shift 2 output" is not.
Maximum 2 sentences in notable register. If context requires more, it has escalated to urgent.
Example:

Station 7 cycle time up 12 seconds since 14:00. Previous average: 43 seconds. Current: 55 seconds.

URGENT — Action is required
Tone: Direct. Precise. Respectful of the operator's competence. Urgent copy does not panic. It does not use exclamation marks. It does not use the word "immediately" unless the condition is genuinely time-critical to the second. The urgency is communicated through specificity and completeness, not through emotional language.

Sentence structure: The first sentence states the condition and its location. The second sentence states the operational consequence if known. No sentence uses the word "must" directed at the operator. The system reports; the operator decides.

Rules:

Urgent copy must always include: what, where, and since when. Missing any of these three makes the copy incomplete and forces the operator to spend mental energy on investigation rather than response.
Never use passive voice in urgent register. "Machine stopped" is not sufficient. "Press 4 stopped at 14:32. Output paused." is complete.
Do not layer urgency. One urgent statement, one consequence, one location. If multiple urgent conditions exist, each is its own entry. They are not combined into a summary. Combining them forces the operator to hold multiple items in working memory simultaneously, which increases error rates.
The word "critical" is not urgent copy. It is decoration. If the condition is urgent, the specific consequence communicates the urgency without the word.
Example:

Press 4 stopped at 14:32. Output on Line 2 paused. Operator: Mehmet A. has been notified.

1.3 Metric Naming Conventions
Metric names are not labels for data engineers. They are labels for people who have been on their feet since 6am and need to read a number and understand it in under one second. The naming convention exists to eliminate the translation step between "what the system calls it" and "what the operator already calls it."

Production metrics must be named in units that match what the operator counts and talks about on the floor. "Units" is specific when every operator knows what a unit is in this context. "Output volume" is not. The name must include the counting unit when ambiguity exists. "Boxes packed" is a metric name. "Pack output" is not. Time-denominated production metrics must include the time window in the name: "Boxes packed — this hour" is correct. "Hourly boxes" is not — it implies an average, not a live count. The rule is: a metric name must answer the question "what am I looking at and for how long" without requiring the operator to read a subtitle.

Machine metrics must use the language of the machine's operators, not the language of the sensor manufacturer. The sensor may report "rotational velocity in RPM." The operator calls it "spindle speed." The interface calls it "spindle speed." If an operator calls a temperature reading "the oven temperature," the metric is named "Oven temperature." Equipment-specific jargon that operators already use is preferred over standardized industrial terminology. The engineer's glossary does not override the floor's vocabulary. Machine metric names must always include the specific machine identifier as a prefix, never as a subtitle: "Press 4 — cycle time" not "Cycle time (Press 4)."

Financial metrics must be named to match the cost center language of the person reading them. A production accountant reads "material cost per unit." An owner reads "gross margin this week." A supervisor does not read financial metrics — they see production metrics with cost context only when relevant to their decisions. Financial metric names must never use financial abbreviations (COGS, EBITDA, WIP) unless the audience is confirmed to be financial staff. The rule for financial metric naming is: name it as you would say it in a budget review meeting with a non-financial manager present.

The governing rule across all metric naming: Every metric name must be readable aloud by an operator without sounding like they are reading a technical document. If it sounds like a report header, rename it. If it sounds like a data field, rename it. If an operator would point at it and say "what's that?" the name has failed.

SECTION 2 — TONAL HIERARCHY DOCTRINE
2.1 Tier Definitions and Composition Rules
The visual hierarchy of FactoryNerve is not about making important things visually louder. It is about making the system's normal state visually quiet enough that when something notable or urgent appears, its weight is immediately perceptible without any additional visual treatment. The system earns its alerts by being silent first.

TIER 1 — Operational Silence
Tier 1 is the dominant visual register of the interface. It is the language of a system in control. It does not perform health — it embodies it through restraint.

Background treatment: Neutral light surface. In light mode: near-white with a warm undertone, specifically not pure white (#FFFFFF) which reads as blank rather than present. Suggested: #F7F6F4 or equivalent warm off-white. In dark mode: deep neutral with no blue or purple cast — a tone that reads as "workshop" not "server room." #1C1B19 or equivalent. The background must never communicate state through color. A green background is not calm — it is a status indicator wearing a background costume.

Text color and weight: Primary text in Tier 1 is medium-dark, never maximum contrast. The reason: maximum contrast (#000 on #FFF) is a reading document treatment, not an operational environment treatment. An operator looking at this interface for eight hours should not feel like they are reading a spreadsheet. Primary text weight in Tier 1 is Regular (400). Labels: Medium (500). No Bold in Tier 1 except for metric values.

Border rule: Borders in Tier 1 are present but recessive — 1px, low-opacity (≤30% of the text color, never a primary palette color). Borders in Tier 1 exist to separate spatial zones, not to communicate status. A border that communicates status has escalated out of Tier 1.

Badge or indicator rule: No badges in Tier 1. No pulsing dots. No "live" indicators. No colored chips. If a Tier 1 surface needs a count, the count is plain text in the appropriate metric naming format. The temptation to add a small grey badge to a Tier 1 surface "just for information" must be resisted. Every badge is a visual request for attention. Tier 1 does not request attention.

Typography register: Body: 14px Regular, 1.5 line-height, tracking 0. Labels: 11px Medium, uppercase, tracking +0.08em. Metric values: 24–32px Medium (never Bold — bold metric values suggest urgency that may not be present). Sublabels: 11px Regular, 60% opacity of primary text color.

Emotional temperature: The operator feels settled. They feel in command of their environment. The interface communicates without demanding. This tier must feel like arriving at a workstation where everything is ready — not like arriving at a dashboard that needs to be interpreted.

TIER 2 — Operational Attention
Tier 2 is not an alert. It is the system sharing information it assessed as worth surfacing. The operator is not required to act. They are invited to attend.

Background treatment: A subtle tint that distinguishes the surface from Tier 1 without producing alarm. A warm amber at 8–12% opacity over the Tier 1 background is the correct range. This tint must be perceptible but not immediately readable as "something is wrong." It reads as "something has changed." Do not use yellow, which reads as warning. Do not use orange, which reads as danger. The warm amber at low opacity reads as "attention" and nothing more.

Text color and weight: Primary text shifts to full contrast (the highest-contrast variant of the text scale). Labels shift to Medium (500). The metric value shifts to Semibold (600). This is the only place in the Tier 2 treatment where weight changes — on the primary data point, not on the label.

Border rule: Tier 2 surfaces carry a left accent border, 2px, in the attention amber, at 60–70% opacity. This border is structural: it tells the eye where the Tier 2 surface begins. It must always appear on the left edge of the card or row, never the top or bottom. A top border is a separator. A left border is a state indicator. These are semantically different and must not be confused.

Badge or indicator rule: A single small dot indicator (8px diameter, amber, no pulse) is permitted on the component's icon or header area. This dot must be static. Pulsing dots in Tier 2 communicate urgency the tier does not have. The dot's purpose is scannability — an operator scanning the environment must be able to identify all Tier 2 items without reading copy. The dot enables this without creating alarm.

Typography register: Body: 14px Regular → 14px Medium. Labels: 11px Medium uppercase, tracking +0.08em, amber tint. Metric values: 24–32px Semibold. The shift from Regular to Semibold on the metric value is the primary visual signal at this tier. No size changes are permitted in tier transitions — only weight changes. Size changes communicate tier changes too aggressively and produce visual noise.

Emotional temperature: The operator feels informed. Their attention has been called without being demanded. They have the information they need to decide whether to act. The interface has done its job. The operator now does theirs.

TIER 3 — Operational Alert
Tier 3 is the system exercising its authority to interrupt. It must earn this interruption every time it deploys it. Tier 3 components that appear for non-urgent conditions erode the operator's trust in the entire system. A system that cries Tier 3 for minor variations will be ignored the moment a genuine Tier 3 condition occurs.

Background treatment: Tier 3 surfaces do not use red backgrounds. Red backgrounds in operational interfaces produce panic, which reduces decision quality. The correct treatment is a warm rust-red at 12–16% opacity over the Tier 1 background. The surface reads as alarmed without producing alarm in the operator. The distinction matters: the surface must communicate that a response is needed, not that catastrophe is in progress.

Text color and weight: Primary text at full contrast. All text in Tier 3 shifts to Medium or above. No Regular weight exists in Tier 3. The metric value shifts to Bold (700) — the only instance in the system where Bold is used on a metric. The operator's eye must land on the number first.

Border rule: Tier 3 surfaces carry a left border, 3px, in a desaturated rust-red at full opacity. The increased border width (from 2px in Tier 2 to 3px here) is the only dimensional change permitted between tiers. The border is still on the left. The color is now identifiably alert without being aggressive.

Badge or indicator rule: A filled badge in rust-red with white text is permitted for counts (e.g., number of affected stations). This badge must be static — never pulsing. If the count changes, the badge updates. It does not animate the update. The reason: a pulsing badge demands sustained attention. The operator's attention should be captured once, redirected to the condition, and then released. Animation that continues after the operator has looked creates distraction that competes with the cognitive work of response.

Typography register: Body: 14px Medium. Labels: 11px Semibold uppercase, tracking +0.08em, rust-red. Metric values: 24–32px Bold. Alert label (the one-line condition summary): 13px Semibold, sentence case, rust-red at full opacity. No all-caps in alert copy — all-caps communicates shouting, which raises the operator's anxiety without adding information.

Emotional temperature: The operator feels called to action, not alarmed. They feel confident that the system has identified something real. They trust the Tier 3 signal because the system has not overused it. They experience urgency calibrated to the actual operational impact, not urgency generated by visual drama.

2.2 Composition Law
A healthy screen at any given moment must consist of approximately 80% Tier 1 surfaces, 15–18% Tier 2 surfaces, and no more than 2–5% Tier 3 surfaces. These are not soft guidelines. They are compositional contracts.

If Tier 3 content exceeds 5% of visible screen real estate, the interface has one of two problems: either genuine operational failure has occurred across multiple systems simultaneously (in which case the Tier 3 threshold is appropriate and the operator needs to escalate beyond the interface), or the Tier 3 classification criteria are wrong and conditions that should be Tier 2 are being misclassified as Tier 3. The second scenario is the most common failure mode in operational interfaces and the most damaging to long-term trust. Recalibrate classification criteria before adjusting visual treatment.

If Tier 2 content exceeds 18% of visible screen real estate on a routine basis — meaning this is a common condition during normal operations — then Tier 2 has been normalized into Tier 1. When the operator sees Tier 2 surfaces so consistently that they stop registering them as distinct, the tier has failed. The response is to elevate the threshold for Tier 2 classification, not to make Tier 2 more visually aggressive.

Tier transition behavior: When a surface transitions from Tier 1 to Tier 2, the visual change must occur in a single smooth cross-fade over 200ms. No bounce. No slide. No color pop. The element does not move. Its visual properties change in place. When a surface transitions from Tier 2 to Tier 3, the same 200ms cross-fade applies. The left border changes weight and color as part of the same transition. When a surface recovers from Tier 3 to Tier 2 or Tier 1, the reverse transition occurs at 300ms — slightly slower than the alert transition. The reason: a slower recovery transition communicates that the system has confirmed the condition has passed, not that the condition was dismissed. Recovery must feel deliberate.

2.3 Breathing Rhythm Rule
Visual silence in FactoryNerve is not empty space waiting to be filled. It is the operational background against which meaningful information becomes visible. The system must resist every instinct — design, product, stakeholder — to fill available space with additional information, widgets, secondary metrics, or contextual details.

The minimum whitespace contract between tiers is as follows: a Tier 1 surface and an adjacent Tier 2 surface must be separated by at minimum 16px of unoccupied space. A Tier 2 surface and a Tier 3 surface must be separated by at minimum 24px of unoccupied space. These gaps are not padding — they are semantic boundaries. They communicate that these surfaces are categorically different, not merely different in content.

The rule for when NOT to add information to a surface: if the information would be visible 90% of the time and actionable 10% of the time, it does not belong on the surface in its default state. It belongs in a secondary expansion or detail view that the operator chooses to access. The default state of every surface must represent the minimum information required for the operator to understand the current condition and decide whether to act. Everything beyond that minimum is cognitive overhead, not value.

Internal empty space within a surface — the area between the metric value and the surface boundary — must be preserved. A card that is 80% full of content has no breathing room for the operator's eye to rest. Surfaces should never exceed 60% information density of their available area. The 40% that remains empty is what makes the 60% readable.

SECTION 3 — WORKSPACE GRAMMAR
3.1 The Three Spatial Scales
FactoryNerve is not a multi-page application. It is a persistent spatial environment with three scales of resolution. Moving between scales is not navigation in the traditional sense — it is focus change. The environment does not disappear when you focus on a station; the plant is still behind you.

PLANT LEVEL
At the plant level, the operator — more accurately, the supervisor or manager — sees the production environment as an interconnected whole. No individual metric is prominent at this scale. The visual language is aggregated health rather than precise measurement.

What is visible at plant level: a schematic representation of the production floor showing all active lines, their aggregate status (Tier 1/2/3 as ambient color treatment on each line's representation), current shift production totals at line level, headcount deployed per area, and any active Tier 3 conditions surfaced as a contained summary in the environment's persistent edge panel. The plant level does not show station-level data. It does not show individual operator assignments. These are details that belong to the lower scales.

The operator's task at plant level is orientation. They are answering the question: "Where does my attention belong?" The plant level surface must be designed to answer this question in under five seconds for any trained operator. If an operator who knows their plant cannot identify where attention is needed within five seconds of landing at plant level, the plant level surface has failed its primary purpose.

LINE LEVEL
At line level, the focus has narrowed to a single production line and all the stations, machines, and operators that constitute it. The line level reveals what the plant level summarizes.

What is visible at line level: all stations on the line with their current condition tier, current operator assignments per station, machine-level readings for each station (the three or four metrics the line operator has defined as meaningful for this line — no generic defaults), production progress against the current shift target with pace indication (ahead / on pace / below pace), and any variations logged in the last two hours with resolution status.

The operator's task at line level is diagnosis. They have already determined at plant level that this line requires attention. Now they must identify where on the line the condition originates. The line level must make the source of a condition visually locatable without the operator reading every station. This is why the tier color system matters at line level: the operator's eye should be drawn immediately to the highest-tier station, then secondarily to adjacent stations that may be affected.

STATION LEVEL
At station level, the focus is on a single station and everything associated with it. This is the most information-dense scale in the system and also the one used by the narrowest audience — typically the line operator or supervisor at that station.

What is visible at station level: the full metric set for this station, the current operator's assignment and recent activity, the process step sequence and current position, machine-specific readings in full, any variations logged at this station with full detail, the last completed cycle's output, and the next scheduled action (changeover, inspection, maintenance). At station level, the full history context is accessible — not displayed by default, but one deliberate action away.

The operator's task at station level is action. They have narrowed from plant to line to station. They are now reading the detailed condition and deciding what to do. Station level must make the operative facts immediately visible and the response path immediately accessible. The operator should never have to search for the action they need to take.

3.2 Navigation Doctrine
Movement between spatial scales is not a page change. It is a zoom. The mental model must be: I am moving closer to or farther from the same environment, not moving between different screens.

An operator moves from plant to line level by selecting a line — clicking, tapping, or keyboard-selecting the line's representation in the plant view. The transition does not cut to a new screen. The plant view contracts as the selected line expands to fill the workspace. The other lines recede but remain partially visible at the environment's left edge as a persistent orientation rail. The operator retains spatial awareness of where they are in the plant even when working at line level.

An operator moves from line to station level by selecting a station in the same manner. The line view contracts and the station expands. The line remains visible as the orientation rail at the same left edge.

An operator moves outward by selecting the orientation rail item for the higher scale. The transition reverses — the current detailed view contracts as the higher view expands. There is no back button. There is no breadcrumb trail that reads like a file path. There is a spatial environment and your current position within it.

What persists across all scales: The persistent edge panel that surfaces active Tier 3 conditions across the entire environment. This panel is always present. It cannot be hidden. It cannot be minimized during an active Tier 3 condition. Its contents update in real time. When no Tier 3 conditions are active, this panel enters its ambient state — present but visually recessive, showing only a confirmation that conditions are within expectation. This panel is the system's commitment to the operator: wherever you are working, you will never miss something that requires your action.

The shift context header also persists: current shift identifier, time remaining, and supervisor on duty. These three items anchor the operator temporally. They appear at the top of every scale and never change position.

What changes: Everything else. The primary content area, the metric surfaces, the station or line representations, the detail panels — these are all context-specific to the current spatial scale.

Motion description: Transitions between scales use a spatial zoom metaphor with the following constraints. The animation duration is 280ms. The easing is ease-out cubic — it begins with momentum and settles smoothly, not the reverse. The selected item (the line or station being drilled into) scales up from its current position in the plant/line view, and the surrounding content fades to 20% opacity as it recedes. The content of the new scale fades in at 60ms into the animation — not at the start, which would be disorienting, and not at the end, which would feel like a cut. The motion must feel like narrowing of focus, not like a door opening. There must be no sliding. Slides communicate lateral navigation between equal peers. Zoom communicates hierarchical depth change.

3.3 Environmental Continuity Rules
The FactoryNerve environment is always present, always attending. It does not wait for the operator to initiate an interaction to update its state. It reflects the current production condition continuously. This continuity is what separates an operational environment from an application.

What is always present: The persistent edge panel with tier-3 conditions or ambient confirmation. The shift header. The orientation rail showing the current spatial path. The primary action area relevant to the current scale. These four elements are the skeleton of the environment. Remove any one of them and the environment becomes an application — something you open, use, and close, rather than something you work within.

The ambient state of the environment when no alerts exist is one of productive quiet. The dominant experience is Tier 1. The orientation rail shows all lines in their ambient color treatment. The persistent edge panel shows a single ambient confirmation line: the current time, shift status, and the line count at planned pace. This ambient state is not a blank slate — it is affirmative. The system is saying "I am watching, and everything is in order" through its visual quietness, not through a banner that says "All systems normal."

When a machine goes down: The response is immediate and spatially localized. The station that contains the downed machine transitions to Tier 3 treatment. If the operator is currently at plant level, the line containing that station elevates to a notable state and the persistent edge panel surfaces the condition. If the operator is at line level for an unrelated line, the orientation rail shows the affected line elevating in tier. The environment does not interrupt the operator's current focus with a modal. It surfaces the condition in the persistent panel and the orientation rail simultaneously, giving the operator the information and the judgment — the decision to navigate to the affected area belongs to them.

Recovery: When the machine condition resolves, the tier transitions follow the recovery timing (300ms, slower than the alert transition). The persistent edge panel updates its entry to show the condition as resolved with a timestamp. The entry does not disappear immediately — it remains in a resolved state for 15 minutes before entering the shift log. This 15-minute window is intentional: it allows any operator who joins the environment after the event to see that a condition occurred and was resolved, rather than encountering a clean environment with no context for what may have changed.

3.4 Spatial Silence Doctrine
Certain areas of the FactoryNerve environment must be protected from content. These are not areas that haven't been designed yet. They are areas that have been intentionally left open.

The orientation rail's ambient state, when no spatial path is active, must be visually empty except for the plant-level summary representations. The temptation to fill this rail with recent activities, quick links, or secondary navigation must be resisted absolutely. The rail is for orientation. When it becomes a navigation panel, it stops serving its purpose.

The area below the shift header and above the first content surface must maintain a minimum of 24px clear space. This is the breath between the system's temporal anchor and the operational content. Collapsing this space — to fit more content, to make a module feel more prominent — destroys the visual rhythm that makes the header feel authoritative. The header must float above the content, not sit flush against it.

The principle: empty space in an operational environment is the visual equivalent of a steady operational pace. A factory running at sustainable pace has rhythms and pauses. A factory running at maximum stress has no pauses — everything is urgent, everything is at the boundary. The interface must reflect the former, not anticipate the latter. Filling every surface with every available piece of information does not make operators more informed. It makes them more exhausted.

SECTION 4 — COMPONENT BEHAVIORAL CONTRACTS
Contract 1: Metric Surface
Purpose: Displays a single measured value with its name, current reading, and production context — the primary atomic unit of operational information in the system.

Allowed states:

Within expectation — value falls within defined acceptable range
Approaching threshold — value within 10% of a defined threshold boundary
Outside threshold — value has crossed a defined threshold
Stale — data has not updated within the expected interval
Unavailable — source data cannot be retrieved
Required contents: Metric name (per naming conventions), current value, unit of measurement, threshold range (displayed as a subtle range indicator, never as a gauge), time of last update.

Prohibited contents: Trend arrows. Sparklines embedded in the primary metric surface (these belong in an expanded detail view, not in the default metric surface). Comparison percentages ("12% above average") — these require the operator to do arithmetic during a scan. Historical value in the primary view. Status labels like "Good," "Normal," or "OK" — the metric's relationship to its threshold communicates this without words.

Typographic rules: Metric name: 11px Medium uppercase, tracking +0.08em, 60% opacity of primary text. Value: 28px Medium for Within-expectation state, 28px Semibold for Approaching-threshold, 28px Bold for Outside-threshold. Unit: 13px Regular, adjacent to value, 60% opacity. Last update time: 10px Regular, 40% opacity, bottom of surface.

Transition behavior: When a metric moves from Within-expectation to Approaching-threshold, the value weight transitions from Medium to Semibold over 200ms and the left border appears (2px, amber, 60% opacity) in the same transition. When it moves to Outside-threshold, the weight transitions to Bold and the border shifts to rust-red (3px) over 200ms. The background tint appears simultaneously. No transition should be perceptible as an animation to the operator — it should register as "that value looks different" rather than "that value just animated." If it looks animated, it is too fast or too slow or too dimensional. The Stale state introduces a dashed border variant (same position, same color as Within-expectation, but dashed) and reduces the value to 40% opacity. The Unavailable state replaces the value with "—" at full opacity.

Emotional contract: The operator glances and continues. The metric surface must deliver its information in the peripheral glance, not the direct gaze. If the operator has to stop and read a metric surface, it has failed its primary purpose. The value of the information is the value, and its relationship to the threshold is the state. Everything else is supporting context.

Contract 2: Machine Status Card
Purpose: Communicates the current operational condition of a single machine, including its running state, relevant readings, and assigned operator.

Allowed states:

Running — operating within all defined parameters
Running with variation — operating but with at least one metric in Approaching-threshold state
Stopped — planned — offline due to scheduled maintenance, changeover, or break
Stopped — unplanned — offline due to unexpected condition
Stopped — waiting — offline, awaiting material, operator, or instruction
Offline — powered down or disconnected from the environment
Required contents: Machine name and identifier, current state label, time in current state, assigned operator name (or "Unassigned"), one to three primary metrics relevant to this machine's running state (configurable per machine type — not a universal default set).

Prohibited contents: Full metric history in the card view. Manufacturer or model information. Maintenance history. Any information that belongs in the machine's detail view rather than its status card. Percentage uptime calculations in the card view — these are reporting metrics, not operational status.

Typographic rules: Machine identifier: 11px Medium uppercase, tracking +0.08em, 50% opacity. Machine name: 15px Medium, full opacity. State label: 12px Semibold, sentence case, color-coded to tier (neutral for Running, amber for Running-with-variation, rust-red for Stopped-unplanned, mid-grey for Stopped-planned or Waiting). Time in state: 11px Regular, 50% opacity. Operator name: 12px Regular, 60% opacity.

Transition behavior: Running to Running-with-variation triggers the Tier 2 background and border treatment as defined in the tonal hierarchy. Running-with-variation to Stopped-unplanned triggers the Tier 3 treatment. Stopped-planned to Running triggers the recovery transition (300ms, slower). The state label text changes as part of the same 200ms transition — there is no intermediate "updating" state displayed. Stopped-waiting does not trigger Tier 3 treatment. It is a Tier 2 condition if it exceeds a defined wait threshold, Tier 1 if the wait is within planned duration.

**Emotional contract

FactoryNerve Operational Design Doctrine
Section 4 — Component Behavioral Contracts (Continued)
Contract 2: Machine Status Card (completion)
Emotional contract: When the operator sees a Machine Status Card in its Running state, they feel nothing — and that is the correct response. The card has done its job by not requiring a reaction. When they see Running-with-variation, they feel oriented: something has shifted and the system has seen it. They are not alarmed; they are informed, and that distinction must be preserved in every visual decision made for this component. When they see Stopped-unplanned, they feel the weight of a specific, localized problem — not a system failure, not a crisis, but a single machine that needs a response. The card must not amplify that weight through visual drama. It must contain it. The operator who sees Stopped-planned feels nothing except confirmation that what was scheduled is occurring as expected. The card in that state is ambient information, and its visual treatment must reflect that. Stopped-waiting communicates a gap in the operational flow — a dependency that has not resolved — and the operator should feel a quiet pull toward investigation, not urgency. A machine waiting is not a machine broken. The card must hold that distinction.

Contract 3: Production Line Summary
Purpose: Presents the aggregate operational condition of a complete production line — its current output progress, pace against target, machine health distribution, and headcount deployment — enabling a supervisor to assess line health in a single directed glance without entering the line level.

Allowed states:

On pace — production rate is within ±5% of planned output rate for the current period
Ahead of pace — production rate exceeds planned output rate by more than 5%
Below pace — production rate is 5–15% below planned output rate
At risk — production rate is more than 15% below planned output rate, or one or more machines on the line are in Stopped-unplanned state
Recovering — line was previously At-risk and production rate is returning toward planned rate within the current period
Idle — planned — line is offline due to scheduled changeover, maintenance window, or planned break
Idle — unplanned — line has produced no output for a period exceeding the defined threshold without a scheduled reason
Required contents: Line name and identifier. Current shift's units produced against shift target, expressed as a plain count ("412 of 680 units"). Current pace indicator — not a percentage, but a directional word drawn from the Ambient register: "On schedule," "Ahead," "Below pace," "At risk." Time remaining in current shift. Number of stations active on the line (and total station count). Number of machines with a condition other than Running, if any (present only in Below-pace, At-risk, Recovering, and Idle-unplanned states; absent in all other states because its presence when all machines are running implies that machines not running is a notable condition rather than the expected baseline).

Prohibited contents: Average efficiency percentage as a primary metric. The reason: efficiency percentages compress multiple variables into a single number and require the operator to know the calculation to interpret the result. An operator who sees "87% efficiency" must ask themselves what constitutes 100% and what inputs are being measured. That is a cognitive translation step performed under shift pressure, which introduces the risk of misread conditions. Show the components, not the compression. Sparklines or trend graphs in the summary card. The reason: a Production Line Summary is a current-state component. It communicates what is happening now. Historical trend belongs in the line's detail view, which the operator accesses deliberately. Embedding trend visualization in the summary blurs the temporal frame and causes operators to respond to past conditions that have already resolved, producing unnecessary interventions. Color-coded "health scores" using green/amber/red traffic light conventions. The reason: the tier system already communicates state through the card's background and border treatment. A second color-coded overlay creates two competing state communication channels on the same surface, and operators will default to the more familiar traffic-light convention, rendering the tier treatment meaningless. Headcount count displayed as a fraction of total available workforce across the plant. The reason: line-level headcount must be read in the context of that line's requirements, not the plant's total staffing pool. Displaying it as a plant fraction causes supervisors to misread adequate line staffing as insufficient when plant-level headcount is below peak.

Typographic rules: Line identifier: 11px Medium uppercase, tracking +0.08em, 50% opacity of primary text. Line name: 16px Medium, full opacity, sentence case. Produced/target count: 26px Medium (On-pace, Ahead), 26px Semibold (Below-pace), 26px Bold (At-risk, Idle-unplanned). "of [target] units" appended to count: 14px Regular, 60% opacity, same baseline as count value. Pace indicator word: 12px Semibold, sentence case, color drawn from tier — neutral text in On-pace and Ahead states, amber in Below-pace, rust-red in At-risk and Idle-unplanned, a returning-amber in Recovering. Time remaining: 11px Regular, 50% opacity. Station count line: 11px Regular, 50% opacity, Tier 1 treatment in all states. Machine condition count (when present): 12px Medium, amber in Below-pace state, rust-red in At-risk state, accompanied by a 6px dot indicator in the same color at the text's left edge.

Transition behavior: On-pace to Below-pace: 200ms cross-fade, weight shifts on the count value, pace indicator color changes, left border appears (2px, amber, 60%) in the same transition. Below-pace to At-risk: 200ms cross-fade, weight shifts to Bold, border shifts to 3px rust-red, background tint deepens from amber to rust-red at 12% opacity. At-risk to Recovering: this transition specifically uses 400ms rather than the standard 200ms. The reason: recovery from an alert state must feel deliberate and confirmed, not instantaneous. A rapid visual snap from Tier 3 to Tier 2 treatment creates the impression that the system has cleared the condition rather than that the condition is genuinely resolving. The slower transition communicates that the environment is watching the recovery in progress, not declaring it complete. Recovering to On-pace: standard 200ms cross-fade. The border does not disappear abruptly — it fades through a 100ms opacity transition after the 200ms state transition completes, for a total of 300ms from state change to fully ambient appearance. Idle-planned: the entire card reduces to 70% opacity of its Tier 1 treatment, communicating presence without operational currency. No border. Idle-unplanned: Tier 3 treatment, full opacity.

Emotional contract: The supervisor looking at a Production Line Summary in On-pace state experiences the productive quiet of a system in control — the card has nothing to demand and asks for nothing. Ahead-of-pace carries a quiet satisfaction, but the card must not celebrate this. Celebration at the summary level implies that exceeding pace is exceptional rather than operational. Below-pace creates a low-level directional pull — the supervisor's attention is drawn but not captured. They know where to look next if they choose to. At-risk produces a clear, contained sense of operational responsibility: this line needs a decision. The card communicates the condition without amplifying it, which keeps the supervisor's thinking clear rather than reactive. Recovering is perhaps the most important emotional state to calibrate correctly: the supervisor must feel that the situation is being watched and that progress is real, but that it is not yet resolved. The Recovering card must hold tension without producing anxiety. Idle-planned is confirmatory and recessive. Idle-unplanned is the only state in which the supervisor should feel an immediate pull toward action — and even then, the card's job is to direct that pull, not to produce alarm.

Contract 4: Threshold Badge
Purpose: Communicates, in the smallest possible visual unit, that a specific measured value has crossed or is approaching a defined operational boundary — serving as a scannable state indicator that can be embedded within other components without dominating their visual structure.

Allowed states:

Within range — value is within defined acceptable boundaries; badge is absent
Approaching — value is within the defined proximity threshold of an operational boundary (default: within 10%, configurable per metric)
Exceeded — value has crossed an operational boundary
Threshold undefined — no boundary has been set for this metric; badge is absent
Required contents: In the Approaching state: a compact text label showing the current value and its unit, in the amber tier treatment. In the Exceeded state: the same compact label in the rust-red tier treatment. The badge must contain the value itself, not a descriptor of the value's state. "55°C" is correct. "High temp" is not. The badge is an extension of the metric — it surfaces the metric's value in a context where the full metric surface is not visible.

Prohibited contents: The word "Alert," "Warning," "Caution," or any semantic label that describes the threshold state rather than the metric value. The reason: when a badge reads "Warning," the operator must look elsewhere to understand what is being warned about. When the badge reads the value, the operator has the operational fact immediately. Any icon or symbol inside the badge. The reason: at badge scale (typically 20–24px height), icons reduce to ambiguous shapes that require interpretation. The cognitive cost of interpreting a small icon inside a badge is disproportionate to any benefit over the plain value. The word "threshold" or any reference to the threshold system. The reason: the badge's color treatment communicates the threshold relationship. A badge that also says "near threshold" is redundant, and redundancy at small scale adds visual noise to components that are already managing multiple information layers. Percentage deviation from threshold. The reason: an operator reading "11% above threshold" must reconstruct the absolute value to act. Show the value; the operator knows their machine's parameters.

Typographic rules: Badge text: 11px Medium, no case transformation (display value as-is with unit), tracking 0. Approaching state: amber text on amber background at 12% opacity, no border. Exceeded state: rust-red text on rust-red background at 12% opacity, 1px border in rust-red at 40% opacity. The border on the Exceeded state distinguishes it from the Approaching state at small scale — at 11px, color differentiation alone may be insufficient for operators working in varying ambient lighting conditions. Within-range and Threshold-undefined: badge is not rendered. The absence of the badge is itself the communication.

Transition behavior: The badge does not exist in the Within-range state, so the transition from Within-range to Approaching is an appearance, not a state change on an existing element. The badge appears with a 150ms fade-in — faster than the standard component transition because at badge scale, a slow fade creates the impression of a rendering delay rather than a deliberate state change. The transition from Approaching to Exceeded is a 200ms cross-fade of color properties only — background tint, text color, and border — with no change to the badge's size, position, or text scale. The badge must not grow to communicate urgency. Size increase at badge scale produces layout disruption in the parent component, which draws attention to the layout change rather than to the badge's content. Recovery from Exceeded to Approaching is 250ms. Recovery from Approaching to Within-range is a 150ms fade-out followed by the badge's removal from the layout. The parent component must be designed to accommodate the badge's absence without layout reflow.

Emotional contract: When the operator sees no badge, they feel nothing — which is the correct response to a metric operating within expectation. When they see an Approaching badge, they feel a low-level attentional registration: this number is moving toward its boundary, and it is worth a glance. The badge does not create anxiety. It creates awareness. When they see an Exceeded badge, they feel the specific weight of a crossed line — not catastrophe, but a condition that now requires a decision. The badge must communicate this without performing it. The operator's trust in Threshold Badges across the system depends entirely on the system's discipline in not displaying them when they are not warranted. A badge that appears for routine variation that never leads to consequence will be ignored within a week. The badge is a credibility token. Every unnecessary display spends it.

Contract 5: Alert Row
Purpose: Surfaces a single active operational condition requiring acknowledgment or response, within a list of conditions ordered by operational impact, providing the operator with the specific facts needed to act without requiring navigation to another surface.

Allowed states:

Active — unacknowledged — condition exists and no operator has acknowledged it
Active — acknowledged — condition exists and has been acknowledged by a named operator; no resolution has been logged
Active — in response — condition exists and a response action has been initiated; the responding operator is identified
Resolved — recent — condition has been resolved within the current shift; entry remains visible as operational record
Resolved — aging — condition was resolved more than two hours ago in the current shift or in a prior shift; entry is in its minimum-visibility state before archiving to the shift log
Required contents: Condition description (per Urgent register language rules from Section 1.2 — what, where, since when). Time of first occurrence. Duration in current state, updated continuously. In Active-acknowledged and Active-in-response states: the name of the acknowledging or responding operator, with time of acknowledgment. In Resolved states: the name of the operator who logged resolution and the time of resolution. In Active-in-response state only: a brief description of the response action in progress, maximum 8 words, drawn from Ambient register (present tense, declarative).

Prohibited contents: Severity scores or numerical priority rankings. The reason: operators calibrate urgency through operational knowledge of their machines and processes, not through abstract scores. A severity score of "7/10" on a press stoppage means nothing to a supervisor who knows that press feeds four downstream stations. The operational consequence, stated plainly, communicates priority more accurately than any scoring system. Recommended actions generated by the system. The reason: recommendations produced by the system and displayed in the Alert Row create an accountability gap. When an operator follows a system recommendation and the outcome is poor, the operational feedback loop that builds expertise is broken. The interface must present conditions and facts; the decision to act, and how to act, belongs entirely to the operator. Countdown timers or escalation clocks. The reason: a countdown implies that if the timer expires without action, something worse will happen. In a factory context, that pressure is real — but manufacturing it visually for conditions where the escalation is not automatic, immediate, and predictable creates false urgency that degrades the operator's ability to prioritize correctly. Auto-populated probable cause suggestions. The reason: probable cause displayed before an operator has investigated trains the operator to stop investigating at the first plausible explanation, which produces incorrect diagnoses and repeat conditions. Links to external documentation within the Alert Row. The reason: during an active condition, navigating away from the operational environment to read documentation is an interruption of the response process. Reference materials belong in the component's expansion panel, accessible deliberately, not embedded in the primary row.

Typographic rules: Condition description: 13px Medium, sentence case, full opacity. In Active-unacknowledged state, this is the visual anchor of the row — it should be the heaviest text element present. Time of occurrence: 11px Regular, 50% opacity. Duration: 11px Medium, full opacity, rust-red in Active states (both acknowledged and unacknowledged), amber in Recovering, 50% opacity neutral in Resolved states. Acknowledging/responding operator name: 11px Regular, 60% opacity, preceded by a middle dot separator. Response action (Active-in-response only): 12px Regular, 55% opacity, italic — the italic treatment signals that this text is status narration, distinct from the condition description which is a fact. Resolution note: 11px Regular, 50% opacity, struck through only in Resolved-aging state as the row approaches archival.

Transition behavior: Active-unacknowledged to Active-acknowledged: the row's left border shifts from rust-red (3px) to amber (2px) over 200ms. The condition description weight shifts from Medium to Regular over the same 200ms. The reason: acknowledgment reduces the visual weight of the row because the condition is no longer unattended. This weight reduction must be perceptible — it is how the operator scanning a list of Alert Rows knows which ones have been picked up. Active-acknowledged to Active-in-response: a 200ms cross-fade introduces the response action text and the responding operator's name. No structural change to the row. Active-in-response to Resolved-recent: the row's tier treatment transitions from Tier 3 to Tier 1 over 400ms — the full recovery timing — and the left border fades out over the subsequent 200ms. The resolved entry does not disappear. It becomes ambient. Resolved-recent to Resolved-aging: 300ms transition to 60% opacity of all text elements. The row remains in the list but recedes. Resolved-aging to archived: the row does not vanish. It slides upward out of the visible list area over 300ms as the component's scroll position adjusts. The operator who wants to see it can scroll up to the shift log section.

Emotional contract: The operator scanning a list of Alert Rows in their Active-unacknowledged state must feel that each row contains exactly the information needed to decide what to do — and nothing more. The density of the row is calibrated: enough to act, not enough to overwhelm. When an operator sees a row transition to Active-acknowledged with a colleague's name, they feel the specific operational relief of knowing that someone is on it — and this relief is produced by the design of the component, not by a notification. The Active-in-response state must produce a sense of operational coordination: the system is reflecting that the team is working. When a row resolves, the operator should feel the quiet satisfaction of a closed loop — a condition that opened, was attended to, and closed. The Resolved-aging state communicates that the record is being kept without demanding the operator's attention. The historical record is there. It is just no longer pressing.

Contract 6: Operator Assignment Card
Purpose: Communicates the current assignment status of a single operator — their name, present station, active task, and shift attendance state — enabling supervisors to understand workforce deployment and identify coverage gaps without querying a separate system.

Allowed states:

Assigned and active — operator is present, at an assigned station, and within the expected task scope
Assigned and idle — operator is present and assigned to a station but no task activity has been registered for longer than a defined threshold
Assigned away — operator is logged as temporarily away from their station (break, material run, or supervisor-directed movement) with a return expectation
Reassignment pending — operator's current assignment is ending and a new assignment has not yet been confirmed for the next period
Unassigned — operator is present in the facility and on the active roster but has no current station assignment
Absent — approved — operator did not report for this shift; absence recorded with approval
Absent — unrecorded — operator did not report for this shift; no absence record exists
Required contents: Operator name, displayed as given name and family name initial (e.g., "Mehmet A.") — never as an employee ID number, which dehumanizes the workforce view. Current station identifier and name (in Assigned states). Current task description, maximum 4 words (in Assigned-and-active and Assigned-away states). Time in current state. In Assigned-away state: expected return time if recorded, or "Return unspecified" if not. In Absent-unrecorded state: the text "Not checked in" with the shift start time as reference — not "Missing," which carries an unwarranted alarm valence for what may be an administrative oversight.

Prohibited contents: Performance metrics of any kind — units produced per hour, efficiency ratings, task completion rates. The reason: the Operator Assignment Card is a deployment and coverage tool. Embedding performance data creates a surveillance reading of the component, which erodes trust between supervisors and operators and changes the behavioral context of every interaction with the card. Performance review belongs in dedicated reporting surfaces accessed by authorized roles, never in a real-time assignment view. Attendance history beyond the current shift. The reason: a supervisor managing today's deployment does not need to know that an operator was late three weeks ago. Historical attendance data displayed in a real-time card causes supervisors to make today's decisions through the lens of historical patterns, which increases the likelihood of bias in task assignments. Any indicator that compares one operator's status against another's. The reason: comparative indicators in a workforce view create implicit rankings that affect team dynamics. The assignment card communicates each operator's individual deployment state, not their relative standing. The time the operator last interacted with the system. The reason: "last seen 14 minutes ago" language, borrowed from consumer messaging applications, reads as surveillance in an industrial context and produces justified operator discomfort without adding operational value over the state label already present.

Typographic rules: Operator name: 15px Semibold, sentence case, full opacity in all active states, 50% opacity in Absent states. Station name: 13px Regular, 60% opacity. Station identifier: 11px Medium uppercase, tracking +0.08em, 45% opacity. Task description: 12px Regular, 65% opacity, italicized to signal that this is status narration, not a label. Time in state: 11px Regular, 45% opacity. "Not checked in" label (Absent-unrecorded): 12px Medium, rust-red at 70% opacity — not full rust-red, which would overstate the severity. Expected return time (Assigned-away): 11px Medium, amber treatment in the Approaching-threshold tier color, to signal that the away state is time-bounded without producing urgency.

Transition behavior: Assigned-and-active to Assigned-and-idle: after the defined idle threshold passes, the card's task description fades to 30% opacity over 200ms and a 1px amber dashed left border appears over the same transition. The border is dashed rather than solid to distinguish idle from the standard Tier 2 solid border — idleness is a different category of notable than a threshold approach. Assigned-away to Assigned-and-active: 200ms cross-fade, the dashed border (if present from an extended away period) fades out, and the task description text updates in place. Unassigned state: the station and task fields are replaced by a single centered label "Unassigned" in 12px Regular, 50% amber opacity. The card background carries the Tier 2 amber tint at 8% because an unassigned operator represents a coverage consideration, not an emergency. Absent-unrecorded: the card carries a 1px rust-red left border at 40% opacity — less prominent than a full Tier 3 treatment because an unrecorded absence is an administrative condition that may have a routine explanation, not a confirmed operational problem.

Emotional contract: When a supervisor scans a set of Operator Assignment Cards and all are in the Assigned-and-active state, they feel the quiet operational confidence of a fully deployed shift. When they see Unassigned cards, they feel a clear administrative pull — a gap that needs filling, not a crisis in progress. The card gives them the name and the gap simultaneously, which is all they need to act. Assigned-and-idle should produce a considered pause — an operator who has been idle longer than expected warrants a check-in, and the card's treatment signals this without escalating to an alarm state. Absent-unrecorded must feel like an administrative flag, not a disciplinary cue. The component is reporting a gap in the record. The supervisor determines what it means. Above all, the Operator Assignment Card must never feel like a surveillance instrument. It is a deployment view. Its emotional temperature in normal operations is one of organized oversight — knowing where your team is so you can support them effectively.

Contract 7: Process Step Indicator
Purpose: Communicates the current position within a defined sequence of process steps — where a line, station, or batch currently sits in its operational sequence — enabling an operator or supervisor to read production progress without interpreting raw time or count data.

Allowed states:

Not started — step has not yet been initiated in the current production sequence
In progress — step is currently active and running within expected parameters
In progress — extended — step has exceeded its expected duration threshold without completing
Complete — step has been completed within this production sequence; confirmed by operator or system
Complete — with variation — step was completed but a recorded variation occurred during execution; the step is closed but the variation is part of the record
Skipped — approved — step was intentionally bypassed with supervisor authorization
Blocked — step cannot begin because a predecessor condition has not been met (material unavailability, preceding step incomplete, machine unavailable)
Requires confirmation — step has reached a decision point requiring operator sign-off before progression
Required contents: Step name, in the floor-language convention — not a process code, not a system identifier. Step sequence position ("Step 3 of 8" expressed as a plain count, not a progress bar). Expected duration for In-progress state and the elapsed time since the step began. In the Complete state: the actual duration, displayed alongside the expected duration only if the variance exceeds 10% in either direction — below 10% variance, the duration detail adds no operational value and creates visual noise. In the In-progress-extended state: the elapsed overrun time, not the total elapsed time. The reason: an operator needs to know how far past expected the step has run, not how long it has been running. These are different operational questions. In the Blocked state: the specific blocking condition — one clause, maximum 6 words. In the Requires-confirmation state: the name of the operator whose confirmation is needed (or the role, if an individual has not been designated).

Prohibited contents: Animated progress bars showing step completion percentage. The reason: most process steps do not have meaningful mid-step progress signals. A progress bar on a process step implies a continuous measurable progression that usually does not exist, and operators learn quickly to distrust a progress bar that does not correlate to real step advancement, at which point the component loses meaning entirely. Step completion percentage. The reason: same as above — process steps are binary at the floor level. They are done or they are not done. Acknowledging partial completion states without operational grounding trains operators to expect that partial progress is meaningful, which interferes with the go/no-go judgment that most process step completions require. The names of individual operators responsible for completing previous steps, displayed in the current step's indicator. The reason: displaying who completed predecessor steps in the active step indicator creates a blame-legibility dynamic in the UI. When something goes wrong in a step, operators will reflexively scan the predecessor attribution. Attribution belongs in the shift log, not in the real-time step indicator. Estimated time to completion. The reason: estimated completion times generated without confirmed real-time production data are sufficiently unreliable in industrial environments that they create false confidence in operators who should be monitoring conditions directly. If the estimate is wrong — which it frequently will be — it damages the operator's trust in the entire indicator.

Typographic rules: Step name: 14px Medium, sentence case, full opacity in In-progress and Requires-confirmation states, 70% opacity in Not-started, 80% opacity in Complete states, 50% opacity in Skipped-approved. Sequence position ("Step 3 of 8"): 11px Regular, 45% opacity in all states — this is supporting context, not primary information, and must not compete visually with the step name or duration. Expected/elapsed duration: 13px Medium (In-progress), 13px Regular (Complete without variance), 13px Semibold rust-red (In-progress-extended, showing only the overrun duration). Blocking condition text (Blocked state): 12px Regular, amber, 70% opacity — amber rather than rust-red because a blocked step is a pending condition, not an active failure. Confirmation requirement label (Requires-confirmation): 13px Medium, full opacity, with the confirmation role or name in 12px Regular, 65% opacity on the following line.

Transition behavior: Not-started to In-progress: 200ms cross-fade, step name weight shifts from its reduced opacity to full opacity Medium, duration counter begins from 0. The step's background does not change — the In-progress state is Tier 1 unless a threshold is crossed. In-progress to In-progress-extended: when the overrun threshold is crossed, the duration element transitions over 200ms from its standard treatment to the Semibold rust-red overrun display. The step name weight does not change at this transition. Only the duration changes state. In-progress or In-progress-extended to Complete: 200ms cross-fade to Complete treatment. If the step completed within acceptable variance, the duration display fades to 40% opacity over the same 200ms — the timing detail is now historical context, not operational information. Complete-with-variation: the step carries a 4px dot indicator in amber adjacent to the step name, with no other visual change from Complete treatment. The dot is persistent as long as the variation is unreviewed. Blocked: 200ms cross-fade, the step name reduces to 60% opacity, the blocking condition text appears, and a 1px amber left border appears on the step row. Requires-confirmation: the step carries the same amber left border as Blocked but the background tint is absent — Requires-confirmation is not a blocked state; it is an active state waiting for a deliberate human decision.

Emotional contract: The operator following a Process Step Indicator in normal progression should experience the steady, confirming rhythm of a production sequence advancing as designed. Each In-progress step that completes on time produces the small operational satisfaction of a thing done correctly. In-progress-extended produces a focused awareness without alarm — the step is running long, and the operator now knows it. Blocked produces a clear sense of a specific dependency: the step is not late, it is waiting, and the component tells them what it is waiting for. This is the critical distinction the component must maintain: a blocked step is not a failure. It is a condition. Requires-confirmation must feel like an invitation rather than a summons — the system is asking for a human decision, not flagging a problem. Complete-with-variation must carry a subtle but persistent reminder: the sequence continued, but something in this step's execution was not standard, and that record exists. The operator should feel the sequence's integrity has been maintained while also knowing that a thread exists to pull if the variation becomes relevant later.

Contract 8: Timeline / Shift Log Entry
Purpose: Records a single event, action, condition, or state change within the temporal record of an operational shift — serving as the factual archive that supervisors, managers, and operators rely on for handover, investigation, accountability, and shift-to-shift continuity.

Allowed states:

System-recorded — entry was generated automatically by the environment based on a detected event (machine state change, threshold crossed, assignment change)
Operator-recorded — entry was created by an operator or supervisor through a deliberate log action
Requires review — entry contains a variation or condition that has been flagged for end-of-shift or management review
Reviewed — entry has been reviewed by an authorized role; reviewer name and timestamp are attached
Disputed — an operator has formally noted that the entry's content does not accurately reflect the actual condition; dispute note is attached
Required contents: Timestamp to the minute, never to the second — second-level precision in a shift log implies a level of temporal exactitude that industrial environments do not reliably support and creates false forensic confidence. Event description, in the voice register appropriate to the severity of the original condition. Origin indicator: a small visual treatment distinguishing system-recorded from operator-recorded entries — not a label, but a subtle background or typographic distinction. For operator-recorded entries: the name of the recording operator or supervisor. For machine-related entries: the machine identifier and station. For Requires-review entries: the specific review trigger — one clause stating why this entry requires review. For Reviewed entries: the reviewer's name and review timestamp. For Disputed entries: the dispute note, attributed and timestamped.

Prohibited contents: Automated categorization tags displayed on the entry itself (tags like "Maintenance," "Production," "Safety"). The reason: tags applied by automated categorization are frequently miscategorized, and displaying them on the entry trains supervisors to read the tag instead of the entry. A miscategorized entry that is tagged "Maintenance" will be excluded from a production review even if the content is directly relevant. The tag suppresses the entry's actual information. Confidence scores or reliability indicators on system-generated entries. The reason: if the system is not sufficiently reliable to record an event with confidence, it should not record the event. Displaying a confidence score implies that unreliable data is better than no data, which it is not in a shift log that will be referenced for accountability. Edit buttons visible at all times on all entries. The reason: the shift log must feel like a record, not a form. Entries should be archivally stable in their default appearance. Edit access, where authorized, belongs in an expansion or context action — not as a persistent visible affordance that implies entries are routinely modifiable. Any form of color-coded "mood" or production sentiment indicators on entries ("shift going well"). The reason: these are editorial overlays on what must be an objective operational record.

Typographic rules: Timestamp: 11px Regular, monospaced typeface, 45% opacity — monospaced because timestamps are scanned in columns, and proportional fonts produce misaligned scan paths across a list of time entries. Event description: 13px Regular, sentence case, 85% opacity for System-recorded entries, 90% opacity for Operator-recorded entries. The slight opacity differentiation between origin types makes operator narrative entries slightly more prominent, reflecting the human judgment they represent. Origin indicator (System-recorded): a thin vertical line in neutral grey (2px, 30% opacity) at the left edge of the entry, replacing the standard left border. Operator name (Operator-recorded): 11px Regular, 50% opacity, below the event description. Machine identifier (where applicable): 11px Medium uppercase, tracking +0.08em, 45% opacity, preceding the event description on the same line, separated by a middle dot. Requires-review flag: 11px Medium, amber, right-aligned on the entry row. Reviewed attribution: 11px Regular, 40% opacity, right-aligned below the review flag position. Disputed note: 12px Regular, 65% opacity, indented 16px from the entry's left edge, preceded by a 1px amber left border — giving the dispute visual containment without making it the dominant feature of the entry.

Transition behavior: New entries enter the timeline from the top of the list with a 150ms fade-in only — no slide, no expand. The entry appears in place. The reason: animated entry of new log items in a timeline produces a scanning disruption every time a new event is logged. In an active shift, new entries may appear frequently. Each animation interrupts the supervisor's scan. A fade-in is perceptible enough to register the new entry without interrupting a scan in progress. Transition from any state to Requires-review: the amber flag text appears at the entry's right edge over 200ms. No other change to the entry. Transition from Requires-review to Reviewed: the amber flag f

