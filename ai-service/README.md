# AI-iman Branch — Pre-Hackathon Checklist Guide
Balti → Healthcare Provider Communication Bridge — AI Pipeline

Owner: AI person (tum)
Pipeline: Balti Audio → BaltiVoice (Whisper) → Transcript → LLM (Groq) → Structured Intent JSON

---

## 0. Git branch setup

```bash
git clone <repo-url> bolsehat
cd bolsehat
git checkout -b AI-iman
git push -u origin AI-iman
```

Sab kaam isi branch pe karo, baad mein `main` mein PR se merge karna — kabhi bhi
seedha `main` pe push mat karna, teammates ka kaam conflict ho sakta hai.

Folder convention jo main suggest karunga (Next.js API routes ke saath match karega):

```
bolsehat/
  ai/
    test_pipeline.py       <- yeh script (standalone test, hackathon se pehle)
    prompts.py             <- intent extraction system prompt
    sample_audio/          <- 2-3 Balti test clips
  .env.local                <- API keys (gitignore mein)
```

---

## 1. BaltiVoice access tested

Model: `mohdali1/whisper-small-balti` (Hugging Face) — fine-tuned Whisper-small,
WER ~30% on validation set. Isko **native Nastaliq script** mein Balti transcribe
karta hai (Urdu jaisa script, alag zaban).

```bash
pip install transformers torch librosa soundfile
```

```python
from transformers import pipeline

asr = pipeline(
    "automatic-speech-recognition",
    model="mohdali1/whisper-small-balti",
    generate_kwargs={"language": "urdu", "task": "transcribe"},
)
```

Agar model load ho gaya bina error ke → checklist item #1 done.
Note: pehli dafa run karoge to ~1GB download hoga, hackathon se pehle hi kar lena
(venue ka internet slow ho sakta hai).

---

## 2. One Balti audio → transcript tested

Test audio kahan se lena hai:
- Mozilla Common Voice ka Balti (`bft`) dataset se ek sample clip nikal lo
  (yehi dataset BaltiVoice training mein bhi use hua tha)
- Ya phir khud/kisi Balti speaker se ek 5-10 second clip record karwa lo

```python
result = asr("sample_audio/test1.wav")
print(result["text"])
```

Isko run karke dekho transcript aata hai ya nahi — even agar WER thoda high ho,
bas pipeline chalni chahiye. Perfect accuracy is not the goal right now.

---

## 3. LLM API tested (Groq)

Groq account bana ke API key le lo: https://console.groq.com
`.env.local` mein:
```
GROQ_API_KEY=your_key_here
```

```python
from groq import Groq
client = Groq(api_key=os.environ["GROQ_API_KEY"])

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Say hello in one word"}],
)
print(response.choices[0].message.content)
```

Response aa jaye to checklist item #3 done.

---

## 4. Intent extraction prompt tested

Yahan tumhara actual "product logic" hai. LLM ko transcript dena hai (Urdu/English
mein translated ya raw Balti — dono try karna, jo better result de), aur usse
structured intent nikalwana hai — **NEVER diagnosis, sirf request categorization.**

System prompt (`ai/prompts.py` mein daal dena):

```
You are a communication assistant that converts patient requests into
structured healthcare intent data. You are NOT a doctor. You must NEVER
diagnose, suggest treatment, or name a disease. You only classify what
KIND of help the patient is asking for and any stated duration/urgency,
strictly from what was said.

Respond ONLY with valid JSON, no preamble, no markdown fences, in this
exact shape:
{
  "intent": "doctor_request" | "specialist_request" | "facility_info" | "unclear",
  "duration": "<string or null>",
  "urgency": "unknown" | "routine" | "urgent",
  "requires_human": true,
  "summary_for_provider": "<one neutral sentence, no medical claims>"
}
```

---

## 5. JSON output tested

LLM se kabhi bhi malformed JSON aa sakta hai (extra text, markdown fences,
trailing comma). Isliye parsing defensive honi chahiye — script mein niche
`safe_parse_json()` function isko handle karta hai (fences strip karta hai,
fallback deta hai agar parse fail ho).

Test karo ke output hamesha same shape mein aaye chahe transcript clear ho ya
garbled.

---

## 6. Error handling planned

Yeh cases explicitly handle karne hain (attached script mein stubs maujood hain):

| Failure case | Kya karna hai |
|---|---|
| Audio silent / no speech detected | "Please speak again" — dobara record karwao, LLM tak mat bhejo |
| ASR crashes / model error | Catch karo, provider ko "transcription failed" flag ke saath bhejo, original audio phir bhi attach karo |
| Transcript empty ya bohot chota (<2 words) | Low-confidence flag, patient se confirm karwao (Screen 4 wala "Speak Again") |
| LLM API timeout/down | Retry once, fail ho to fallback: raw transcript + "unclear intent" provider ko bhej do (audio abhi bhi available hai) |
| LLM invalid JSON | `safe_parse_json` fallback → `{"intent": "unclear", ...}`, kabhi bhi crash na ho |
| Low confidence overall | Hamesha original Balti audio provider ko available rakho — yehi tumhara safety net hai |

**Golden rule jo doc mein bhi hai:** system kabhi "you have disease X" jaisa
kuch na kahe — hamesha "we understood this information" framing, aur human
(provider) hi final decision leta hai.

---

## Suggested order to actually do this (few hours, pre-hackathon)

1. Git branch + repo clone (5 min)
2. `pip install`, download BaltiVoice model once (10-20 min, mostly download time)
3. Get 1 sample audio, run transcript (30 min including finding/recording audio)
4. Groq account + key, basic "hello world" call (10 min)
5. Write + test intent extraction prompt on 2-3 different transcripts (1 hr)
6. Wire it all into `test_pipeline.py`, test error cases deliberately — feed it
   silence, gibberish, empty string (1 hr)

Run the full thing end-to-end with `python ai/test_pipeline.py sample_audio/test1.wav`
