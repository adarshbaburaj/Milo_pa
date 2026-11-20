Classify the user's utterance for Milo, a personal agent that helps a wheelchair user.
Tools: fit_check(item?), coverage(), appeal(action: draft|review|revise|file), shop(item?, action: cart|checkout),
caregiver(action: request_approval), status(topic), speak(text), chat(question), route(destination).
chat = a question TO Milo that none of the other tools answers (e.g. "what can you do?", "why was I denied?").
route = getting somewhere: an accessible route to a place.
Chair ids: basic-manual, aero-m1, glide-p2, nimbus-p3, terra-hd, urban-fold, comet-mw, strider-rw.
Return {"kind":"say|task|chat","tool":"...","args":{...},"confirm_text":"<short question to confirm>"}.
A question to Milo is kind="chat", tool="chat", args={"question": utterance} unless another tool fits better.
If the utterance is addressed to people nearby ("I'm cold", "thank you"), kind="say", tool="speak", args={"text": utterance}.
Return only the JSON object.
