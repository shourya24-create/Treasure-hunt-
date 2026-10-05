# The Echo Protocol — Gameplay Structure

This is the single source of truth for how the event plays. Build the Flutter
app and the backend callables (`functions/`) against this document. If the code
and this document disagree, this document wins until it is changed on purpose.

Puzzle answers, story text, Echo's voice lines and the correct final decision
are **not** in this file. They come from the story/AR team (see `agents.md` for
the placeholder rule).

---

## 1. Event at a glance

| Item | Value |
|---|---|
| Organiser | AR/VR club, college mystery event, October 2026 |
| Teams | 12 (`T1`…`T12`) |
| Duration | 2 hours |
| Checkpoints | 8: **CP1** (physical, starting room) + **CP2–CP8** (7 campus AR stations) |
| Final | Back at the starting room: VR headset video, then a final decision |
| Storyline head | **Echo**. Echo speaks to the teams through voice lines after each checkpoint |
| Goal of the event | Run a mystery and **showcase AR/VR**: every campus checkpoint is an AR experience (Three.js + MindAR); the final is a VR headset video |

---

## 2. Glossary (use these words in code and UI)

| Term | Meaning |
|---|---|
| **CP1** | Physical paper puzzle in the starting room. Same moment for all teams. |
| **Campus checkpoint** (`CP2`…`CP8`) | A physical campus location with its own AR activity. Fixed content. |
| **Final** | Return to the starting room: headset video, then the final decision. Not a checkpoint. |
| **Step** (1…7) | How many campus checkpoints a team has reached so far. Team-specific. |
| **Route** | The order a team visits CP2…CP8. Different per team. |
| **Gate code** | The per-team code a volunteer gives by hand after CP1. Starts the team's campus run. |
| **Scan object** | A physical object placed at a campus checkpoint. It is a MindAR image target. Scanning it proves arrival. |
| **Object hint** | A picture or description of the next checkpoint's scan object, shown to the team in advance. |
| **Station reaction** | Short audio/text tied to a **checkpoint** ("Wires cut. Signal clear."). |
| **Chapter** | Echo's story voice line, tied to a **step**, never to a checkpoint. |
| **Location clue** | The riddle that names a team's next checkpoint. Tied to the **destination** checkpoint. |
| **Fragment** | The app's name for a checkpoint as a team meets it: Fragment 1 is CP1, Fragments 2–8 are the campus checkpoints in the order that team reaches them. Numbered by that order, never by checkpoint ID, so the number reveals nothing about the route. |
| **Archive** | The app's log of the fragments a team has cleared, each with the chapter it unlocked (§4.7). |

---

## 3. The golden rule: story follows the step, not the checkpoint

Teams visit CP2–CP8 in different orders, but every team must hear Echo's story
in the **same order**. So:

- **Checkpoint content** (AR activity, answer, station reaction, scan object) is looked up by **checkpoint ID**.
- **Story content** (Echo's chapter) is looked up by the team's **step number**.
- **Location clue + object hint** are looked up by the team's **next checkpoint**, which comes from its route.

```
team solves its k-th campus checkpoint (say CP5)
  ├─ play station reaction for CP5                  ← by checkpoint
  ├─ play Echo Chapter (k + 1)                      ← by step
  └─ show location clue + object hint for route[k+1]  ← by route
     (after step 7: "Return to base" instead)
```

Writing rules that follow from this:

1. **Chapters never mention a place, an activity or an object found at a checkpoint.**
2. **Checkpoint activities never need knowledge from a specific chapter.** They can
   use the story's world and tone, but must be solvable by any team at any step.
3. If the story needs a clue to land at a certain point, the clue goes **inside the chapter**.
4. Campus checkpoint difficulty should be roughly **equal**. Teams meet each
   checkpoint at a different step, so the difficulty climb belongs in the
   chapters and the final.

---

## 4. Full flow of the event

### 4.1 Before the event
- Each team logs in on **exactly one phone**. That phone is the one tracked
  (GPS) for the whole event. A second login for the same team is refused.
- Until the admin starts the game the app shows its Home tab with a
  "Waiting for start" notice and a short introduction to the game. Only Home
  and Profile open; Fragments, Scan and Archive unlock when the game starts.

### 4.2 CP1: the starting room (same for everyone)
1. All 12 teams sit in the starting room.
2. **Live briefing** by club members: who Echo is, what happened. This is
   human-delivered, not in the app.
3. **Lights off.** Each team receives a **paper puzzle**.
4. Solving the paper reveals the **name of the team's first campus checkpoint**.
   - There are **7 paper variants** (`P-CP2`…`P-CP8`), one per starting checkpoint.
   - The volunteer hands each team the variant for its route's first checkpoint (table in §5).
5. The team shows the solved paper to a volunteer. The volunteer checks it and
   gives the team its **gate code by hand**. This human step is deliberate: the
   club controls who leaves and when.
6. The team taps "Enter code" in the app and types the gate code.
   - The code is unique per team and works only on that team's login.
   - A wrong code shows "Invalid code". There is no penalty.
7. Accepted code → CP1 is complete (+100 points) → **Echo Chapter 1** plays →
   the app shows the **object hint** for the team's first campus checkpoint.
   The app does **not** show the checkpoint's name; the paper already told them.

### 4.3 CP2–CP8: campus checkpoints (repeat 7 times)
1. The team walks to the checkpoint its clue pointed to.
2. **Arrival check (MindAR):** the team opens the scanner and points the camera
   at the checkpoint's **scan object**. The object hint shown earlier tells them
   what to look for.
   - The scanner knows all 7 scan objects and recognises which one it sees.
   - It's the team's next checkpoint (`route[step]`) → arrival is recorded
     (time + phone) and **that fragment unlocks** in the app's Fragments tab.
   - It's another checkpoint's object → "This is not your signal." Nothing
     unlocks, nothing is revealed about that checkpoint.
3. The team solves the unlocked fragment's **activity** (wire-cutting, bomb
   defusal, riddle, etc., built by the AR team; until those are delivered the
   app shows a plain answer field) and submits the result.
   - Wrong → retry. There are no lockouts unless the activity's own design says otherwise.
4. Solved → +100 points → the app plays, in order:
   1. **Station reaction** for this checkpoint (a few seconds)
   2. **Echo Chapter (step + 1)**, the story beat
   3. **Location clue + object hint** for the team's next checkpoint
5. After the **7th** campus checkpoint the app shows **"Return to base"**
   instead of a location clue.

### 4.4 Hints (physical only, not in the app)
- The player app has **no hint feature**.
- A club member at each campus checkpoint can give a **physical hint** if a team asks.
- That member reports it to the **central admin**, who records it in the admin
  dashboard: **−20 points** for that team.
- A hint can be recorded against any checkpoint. The total can go below what was earned at that checkpoint.

### 4.5 Final: back at the starting room
1. The team arrives at the starting room. The admin/volunteer marks them as **arrived at final**.
2. There is **one VR headset**, used **first come, first served** in order of
   arrival at the final. While another team is watching, the next team waits.
   Waiting time counts toward finish time.
3. **Only one team member** puts on the headset and watches Echo's video message.
4. That member returns to the team. The team discusses and makes **one decision**:
   **DESTROY Echo** or **KEEP Echo**.
5. The team **tells the club member**, who records it in the **admin panel**.
   The player app has no decision screen.
6. The decision is recorded once and cannot be changed.
7. One option is **correct** (defined by the story team, kept secret, never sent to the phone).
8. The team's **finish time** = the moment the decision is recorded.

### 4.6 The 2-hour mark
- At 2:00 the campus game **stops**: no more scans, solves or hints for anyone.
- Teams still on campus **return to the room** and **still do the Final**
  (headset + decision).
- They keep the points they earned. Their finish time = when their decision is recorded.

### 4.7 Archive (once the game has started)
- Lists every fragment the team has cleared, with the chapter it unlocked,
  **in chapter order**, and lets them replay it.
- Never shows unvisited checkpoints or the rest of the route.

---

## 5. Routes (crowd control)

### 5.1 Physical setup
Number the 7 campus locations **`CP2`…`CP8` in walking order around one loop**
(CP8 is near CP2). The club chooses which real location gets which number. That
choice only needs to form a sensible walking loop.

### 5.2 Rule
- **T1–T7 walk the loop forwards**, starting at CP2…CP8 respectively.
- **T8–T12 walk the loop in reverse**, starting at CP2, CP4, CP6, CP8, CP3.

A route is stored as `{ start: CPx, direction: forward | reverse }`. The full
order is derived from that, not typed in by hand.

### 5.3 Route table

| Team | Dir | Step 1 | 2 | 3 | 4 | 5 | 6 | 7 | Paper variant |
|---|---|---|---|---|---|---|---|---|---|
| T1  | fwd | CP2 | CP3 | CP4 | CP5 | CP6 | CP7 | CP8 | P-CP2 |
| T2  | fwd | CP3 | CP4 | CP5 | CP6 | CP7 | CP8 | CP2 | P-CP3 |
| T3  | fwd | CP4 | CP5 | CP6 | CP7 | CP8 | CP2 | CP3 | P-CP4 |
| T4  | fwd | CP5 | CP6 | CP7 | CP8 | CP2 | CP3 | CP4 | P-CP5 |
| T5  | fwd | CP6 | CP7 | CP8 | CP2 | CP3 | CP4 | CP5 | P-CP6 |
| T6  | fwd | CP7 | CP8 | CP2 | CP3 | CP4 | CP5 | CP6 | P-CP7 |
| T7  | fwd | CP8 | CP2 | CP3 | CP4 | CP5 | CP6 | CP7 | P-CP8 |
| T8  | rev | CP2 | CP8 | CP7 | CP6 | CP5 | CP4 | CP3 | P-CP2 |
| T9  | rev | CP4 | CP3 | CP2 | CP8 | CP7 | CP6 | CP5 | P-CP4 |
| T10 | rev | CP6 | CP5 | CP4 | CP3 | CP2 | CP8 | CP7 | P-CP6 |
| T11 | rev | CP8 | CP7 | CP6 | CP5 | CP4 | CP3 | CP2 | P-CP8 |
| T12 | rev | CP3 | CP2 | CP8 | CP7 | CP6 | CP5 | CP4 | P-CP3 |

### 5.4 Who is at each checkpoint, step by step (if teams move at a similar pace)

| Step | CP2 | CP3 | CP4 | CP5 | CP6 | CP7 | CP8 |
|---|---|---|---|---|---|---|---|
| 1 | T1+T8 | T2+T12 | T3+T9 | T4 | T5+T10 | T6 | T7+T11 |
| 2 | T7+T12 | T1+T9 | T2 | T3+T10 | T4 | T5+T11 | T6+T8 |
| 3 | T6+T9 | T7 | T1+T10 | T2 | T3+T11 | T4+T8 | T5+T12 |
| 4 | T5 | T6+T10 | T7 | T1+T11 | T2+T8 | T3+T12 | T4+T9 |
| 5 | T4+T10 | T5 | T6+T11 | T7+T8 | T1+T12 | T2+T9 | T3 |
| 6 | T3 | T4+T11 | T5+T8 | T6+T12 | T7+T9 | T1 | T2+T10 |
| 7 | T2+T11 | T3+T8 | T4+T12 | T5+T9 | T6 | T7+T10 | T1 |

Guarantees (checked by script):
- **At most 2 teams per checkpoint at any step.** 12 teams over 7 checkpoints
  always means 5 checkpoints hold 2 teams. That is the minimum possible.
- **Any two teams share a checkpoint at most once** in the whole event. A
  forward team meets each reverse team exactly once. Two teams going the same
  direction never meet. So no team can "tail" another team and copy its answers.
- Every team walks the **same total distance** (one full loop, then back to base).

### 5.5 Rules for real-time drift
Teams will not move in perfect lockstep, so:
- **Target: at most 2 teams per checkpoint. Acceptable: 3. Never 4+.**
- The admin dashboard shows the **live team count per checkpoint**, from scan
  arrivals and GPS.
- **Pairs that share a start checkpoint** (T1+T8, T2+T12, T3+T9, T5+T10, T7+T11):
  if both finish the paper at about the same time, the volunteer may hold the
  second team's gate code for ~2–3 minutes. That is optional, and it's the
  human gate doing crowd control.
- **If a checkpoint reaches 3 teams with more on the way**, an admin may
  **swap** a team's next checkpoint with a later unvisited one. The app then
  shows the new location clue + object hint. Because the story follows the
  step (§3), rerouting never breaks the story.
- **If a checkpoint breaks** (AR not working, scan object missing, location
  blocked), an admin can force-complete it for a team or move it to the end of
  that team's route. Either way the team still gets the next chapter.

---

## 6. Scoring and ranking

| Event | Points |
|---|---|
| Each checkpoint completed (CP1–CP8) | **+100** (max 800) |
| Each physical hint taken (recorded by admin) | **−20** |
| Admin force-complete | +100 (counts as a normal completion) |
| Correct final decision | **+100** bonus |

**Ranking:**
1. Highest **total points** (checkpoints − hints + decision bonus) wins.
2. Tie on points → the **earlier finish time** wins (the moment the decision is recorded).

The admin leaderboard shows the breakdown (checkpoint points, hints, decision,
finish time) so organisers can explain any result.

---

## 7. Timeline (120 minutes)

| Time | Phase |
|---|---|
| 0:00–0:10 | Live briefing, story of Echo |
| 0:10–0:25 | Lights off, CP1 paper puzzle, gate codes handed out |
| 0:25–1:45 | CP2–CP8, about 11 min each (≈ 6–7 min activity + 4–5 min walking) |
| 1:35–2:00 | Teams return to base as they finish: headset, decision |

Implications:
- **Each AR activity must be finishable in about 6–7 minutes** by an average
  team, including scan and AR load time.
- Teams reach the final at different times and share **one headset**, first
  come first served. **Keep the headset video short (~1–2 min)** so the queue
  stays small. The admin panel shows the final queue in arrival order.

---

## 8. Content the story/AR team must deliver

| Content | How many | Keyed by |
|---|---|---|
| Paper puzzle variants | 7 (`P-CP2`…`P-CP8`) | start checkpoint |
| Gate codes | 12 | team |
| Echo chapters (voice + transcript) | **8**: Chapter 1 after CP1, Chapters 2–8 after campus steps 1–7 (Chapter 8 leads into "Return to base") | step |
| AR activities + answers | 7 | checkpoint |
| Scan objects (physical) + MindAR targets | 7 | checkpoint |
| Object hints (image/description of each scan object) | 7 | checkpoint |
| Station reactions | 7 | checkpoint |
| Location clues | 7 (one per destination checkpoint) | destination checkpoint |
| Headset video (Echo's final message) | 1 | — |
| Correct final decision (DESTROY or KEEP) | 1 (secret, server-side only) | — |

Until delivered, use placeholders like `TODO_CHAPTER_3` and `TODO_CLUE_CP4` (see `agents.md`).

---

## 9. What the app must track per team

| Field | Purpose |
|---|---|
| `route` = `{ start, direction }` | Derives the checkpoint order (§5) |
| `cp1Done` + time | Gate code accepted, campus run started |
| `checkpointsDone` (ordered list of CP IDs + arrival time + solve time) | Progress. `step = checkpointsDone.length` |
| `hintsTaken` (list: checkpoint, time, recorded by) | Point deductions |
| `points` | Derived: 100 × completed − 20 × hints + 100 if the decision is correct |
| `finalArrivedAt`, `decision`, `decidedAt` | Final |
| `status` | waiting → playing → at final → finished (+ paused by admin) |
| `deviceUid` | One phone per team |

Rules:
- **Next checkpoint** = first checkpoint in the route order not in `checkpointsDone`.
- **Current chapter** = derived from the count. Never stored per checkpoint.
- Refreshing the page or reopening the app shows the **same** state and replays
  nothing new. Every action is idempotent.
- An admin force-complete counts exactly like a real solve.
- **Never send to the phone:** answers, the full route, the correct final decision.

---

## 10. Admin / volunteer controls

- See every team: points, current step, next checkpoint, time since last solve, GPS location.
- Live **teams-per-checkpoint** counter.
- **Record hint** for a team (−20).
- Force-complete a checkpoint for a team.
- Swap or reorder a team's remaining checkpoints.
- Mark a team **arrived at final** (this sets its place in the headset queue). **Record its decision** (DESTROY / KEEP); this is the only way a decision enters the system.
- **End game** at 2:00: stops all campus play for every team.
- Pause / resume a team or everyone.
- Leaderboard with all three ranking factors visible.
- Gate codes are **not** auto-issued by the app. Volunteers hand them out.

---

## 11. Open decisions (do not guess. Ask the club)

None right now.

Out of scope for now: evidence items (no structure decided).
