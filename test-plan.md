# WatchTogether — E2E Test Plan

**Scope:** PRs #1 + #2 combined on branch `devin/1777397856-prompt-2-url-sync-emoji`.

**App under test:**
- Frontend: `http://127.0.0.1:5173` (Vite dev)
- Backend: `http://127.0.0.1:3001` (Express + Socket.io, `/health` returns `{"ok":true}`)

**Method:** Two Chrome tabs in the same browser pointed at the same room URL. Each tab gets its own websocket so the server treats them as two distinct users in a 2-person room. Recording covers the full primary flow.

**Up-front limitations** (calling these out so they aren't silently skipped):
- **Voice call audio** — VM has no microphone, so `getUserMedia({audio:true})` may either deny or return a silent track. I will verify the UI states (mic-permission attempt, "Voice" header presence, mute button rendered) but **cannot verify that audio actually flows between the two peers**. This will be marked **untested**.
- **Screen share** — `getDisplayMedia` opens a Chrome picker dialog. I'll click "Share Screen" and verify the picker opens (proves the API call fires), then cancel — I won't run the actual peer connection because picking the recording window itself causes a hall-of-mirrors loop and obscures the test. The receiver-side rendering will be marked **untested**.

These two limitations were the explicit reason for proposing the test up-front; the user accepted ("Both — test, then deploy"). The remaining features (which are the new ones this PR cycle introduced) are fully testable.

---

## Test 1 (PRIMARY) — URL Mode end-to-end sync

**Why this matters:** URL Mode + the `sync-event` server relay + the `isRemoteAction` echo-suppression are the highest-risk new logic in PR #2. If the sync logic were broken (echo loop, no relay, partner doesn't get the URL, seek not applied) this test fails visibly.

### Setup (not part of recording)
- Recording starts AFTER both tabs are open and joined to the same room.

### Steps & assertions

1. **Open Tab A** at `http://127.0.0.1:5173`.
   - **Pass:** Home page renders with heading text exactly `WatchTogether 🎬` and a `Create Room` button.
   - **Fail signal if broken:** Different heading, no button, blank screen.
2. **Click `Create Room`.**
   - **Pass:** URL changes to `/room/<8-char-id>`. Room page renders. Top bar contains `Room: <id>`. The connection dot is **gray** (waiting). Toast does NOT appear yet (no partner).
   - **Fail signal:** Stays on home page (room creation failed), or dot is green before any partner joins (false-positive).
3. **Copy the URL bar value, open a new Chrome tab (Tab B), and load the same URL.**
   - **Pass in Tab A:** Toast appears at top-center reading exactly `Partner joined!` with green border. Connection dot turns **green**. Header text changes to `Partner connected`.
   - **Pass in Tab B:** Connection dot is **green** on arrival. Header reads `Partner connected`. No `Partner joined!` toast (Tab B is the joiner, not the existing peer).
   - **Fail signal:** No toast in Tab A (event-wiring broken), or dot stays gray after partner is in (server room state broken — exactly the bug we just fixed in commit `19fc908`).
4. **In Tab A, click the `URL Mode` toggle.**
   - **Pass:** The toggle pill turns indigo on `URL Mode`, the screen-share placeholder is replaced by an input field with placeholder text `Paste a direct video URL (.mp4, .m3u8, .webm)` and a `🎞️` icon underneath.
   - **Fail signal:** Toggle doesn't change appearance, or screen share UI remains visible.
5. **In Tab B, click the `URL Mode` toggle as well** (so both are in the same mode).
6. **In Tab A, paste `https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4` and click `Load video`.**
   - **Pass in Tab A:** A `<video>` element appears with native browser controls.
   - **Pass in Tab B:** The same URL is auto-loaded (placeholder disappears, `<video>` element appears) WITHOUT manual entry. This proves the `url-changed` sync-event relay works.
   - **Fail signal:** Tab B placeholder remains, or Tab B shows the icon-only state — the relay is broken.
7. **In Tab A, click play on the video.**
   - **Pass in Tab A:** Video begins playing.
   - **Pass in Tab B:** Within ~1 second, Tab B's video also begins playing at approximately the same `currentTime` (the play `sync-event` was relayed and the `isRemoteAction` ref correctly suppressed Tab B's own re-emit).
   - **Fail signal:** Tab B stays paused, or there is a visible echo-storm where the video stutters/restarts (would mean `isRemoteAction` flag is broken).
8. **In Tab A, click pause.**
   - **Pass in Tab B:** Video pauses within ~1 second.
   - **Fail signal:** Tab B continues playing.
9. **In Tab A, scrub to ~5s using the native video timeline.**
   - **Pass in Tab B:** Tab B's currentTime jumps to ~5s (within the 0.4s `SEEK_THRESHOLD` window).
   - **Fail signal:** Tab B stays at the old time.

### Adversarial considerations addressed
- A broken relay (e.g., echoing back to sender) would create an infinite play→pause→play loop visible as stutter — the test sequence (play, pause, seek) would expose it.
- A missing `url-changed` event would leave Tab B at the placeholder — step 6 catches that.
- A broken `isRemoteAction` ref would cause exponential `sync-event` traffic — visible as stutter and observable in the network tab.

---

## Test 2 — Chat + Reactions + Toasts

This is fast and adds little time, but covers two more new features (`chat-message` already existed but the timestamps + emoji quick-row are new in PR #2; `reaction` event is fully new).

### Steps & assertions

1. **In Tab A, type `hello from A` in the chat input and click `Send`.**
   - **Pass in Tab A:** Bubble appears right-aligned, indigo background, text `hello from A`, with a `HH:MM` timestamp directly underneath.
   - **Pass in Tab B:** Bubble appears left-aligned, dark gray background, same text and timestamp.
   - **Fail signal:** No timestamp visible (PR #2's added `formatTime` not wired), or bubble appears on the wrong side (sender mismatch).
2. **In Tab A's chat panel, click the `❤️` button in the row above the chat input.**
   - **Pass in both tabs:** A new `❤️` chat bubble appears (this is the inline emoji-as-message quick-send, not the reactions panel — confirmed by reading `Chat.jsx`).
3. **In Tab A's `Reactions` panel, click the `❤️` button.**
   - **Pass in BOTH Tab A and Tab B:** A floating heart appears at the bottom of the Reactions card and animates upward over ~2.4s before disappearing. It must appear in **both** tabs — sender included — to prove the server-side `reaction` event broadcasts to the whole room (not just the partner) and that the listener is wired on both sides.
   - **Fail signal:** Heart only appears in Tab A (broadcast logic broken), or doesn't appear at all (animation/CSS broken).
4. **Close Tab B.**
   - **Pass in Tab A:** Toast appears reading exactly `Partner left the room` with red border. Connection dot returns to gray.
   - **Fail signal:** No toast (disconnect handler not firing), or wrong text.

---

## Tests deliberately marked untested
| Feature | Why |
|--|--|
| Voice call peer audio | No real mic on VM; `getUserMedia` likely fails or returns silent track |
| Screen share receiver-side video | Picker dialog requires manual interaction; recording-of-recording would obscure |
| Mobile responsive layout | Recording is on desktop; user can verify on phone after deploy |
| Reconnection flow ("Partner reconnected!") | Closing+reopening Tab B is a partner-left + partner-joined cycle, which is what step 4 of Test 2 already covers |

---

## Exit criteria
- Test 1 steps 1–9 all pass: PR #2's URL Mode sync is verified end-to-end.
- Test 2 steps 1–4 all pass: chat/reactions/toasts (new in PR #2) are verified.
- Failures or "untested" items are reported clearly to the user, not glossed over.
