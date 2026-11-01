"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extract, type Extracted } from "@/lib/voice/extract";
import { STATUS, STATUS_ORDER, type Status } from "@/lib/types";
import { postUpdate } from "@/lib/upload";
import { Mic } from "./Icons";
import { Close } from "./Icons";
import { useToast } from "./Toast";

type TaskLite = { id: string; seq: number; title: string };
type Current = TaskLite & { status: Status; progress: number; manpower: number | null };
type Props = { tasks: TaskLite[]; taskId?: string; current?: Current; language: string; areaId?: string; canUpdate?: boolean };

const SPOKEN: Record<string, string> = { hi: "Hindi", kn: "Kannada", mixed: "Hindi and English" };
const LANGS: [string, string][] = [["en-IN", "English"], ["hi-IN", "हिन्दी"], ["kn-IN", "ಕನ್ನಡ"]];

export function MicButton(props: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (props.current && new URLSearchParams(window.location.search).get("voice") === "1") setOpen(true);
  }, [props.current]);
  return (
    <>
      <button className="fab" type="button" aria-label="Record a voice update" onClick={() => setOpen(true)}>
        <span className="pulse" /><Mic />
      </button>
      {open && <VoiceSheet {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function VoiceSheet({ tasks, current, language, canUpdate = true, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState<"listen" | "processing" | "found" | "confirm">("listen");
  const [busyText, setBusyText] = useState("Transcribing…");
  const [engine, setEngine] = useState<{ stt: string; ai: string }>({ stt: "browser", ai: "rules" });
  const [lang, setLang] = useState(LANGS.some((l) => l[0] === language) ? language : "en-IN");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [levels, setLevels] = useState<number[]>(Array(9).fill(0));
  const [micOk, setMicOk] = useState(true);
  const [srOk, setSrOk] = useState(true);
  const [target, setTarget] = useState<Current | null>(current ?? null);
  const [ex, setEx] = useState<Extracted | null>(null);
  const [form, setForm] = useState({ status: "in_progress" as Status, progress: 10, manpower: "", remarks: "" });
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState("");           // transcript as spoken (kept in extracted.original_transcript)
  const [spoken, setSpoken] = useState("en");             // en, hi, kn, mixed, other
  const [notice, setNotice] = useState<string | null>(null);
  const [lockNote, setLockNote] = useState<string | null>(null);

  const finalRef = useRef("");
  const srRef = useRef<any>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const startedAt = useRef(0);
  const listening = useRef(false);
  const langRef = useRef(lang);
  langRef.current = lang;

  const startSR = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSrOk(false); return; }
    try { srRef.current?.abort(); } catch { /* ignore */ }
    const r = new SR();
    r.lang = langRef.current;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let fin = "", tmp = "";
      for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript + " ") : (tmp += e.results[i][0].transcript));
      finalRef.current = fin.trim();
      setText(fin.trim());
      setInterim(tmp);
    };
    r.onerror = (e: any) => { if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"].includes(e.error)) setSrOk(false); };
    r.onend = () => { if (listening.current && srRef.current === r) { try { r.start(); } catch { /* already started */ } } };
    srRef.current = r;
    try { r.start(); } catch { setSrOk(false); }
  }, []);

  const stopAll = useCallback(() => {
    listening.current = false;
    cancelAnimationFrame(rafRef.current);
    try { srRef.current?.stop(); } catch { /* ignore */ }
    srRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
  }, []);

  const startListening = useCallback(async () => {
    setPhase("listen"); setText(""); setInterim(""); finalRef.current = ""; blobRef.current = null; chunks.current = []; setEx(null); setNotice(null); setLockNote(null); setOriginal(""); setSpoken("en");
    listening.current = true; startedAt.current = Date.now();
    startSR();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.start(1000);
      recRef.current = rec;
      const ac = new AudioContext();
      audioCtxRef.current = ac;
      const an = ac.createAnalyser();
      an.fftSize = 64;
      ac.createMediaStreamSource(stream).connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(data);
        setLevels(Array.from({ length: 9 }, (_, i) => data[i + 1] / 255));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setMicOk(false);
    }
  }, [startSR]);

  useEffect(() => {
    startListening();
    return () => {
      stopAll();
      try { recRef.current?.state !== "inactive" && recRef.current?.stop(); } catch { /* ignore */ }
    };
  }, [startListening, stopAll]);

  const changeLang = (l: string) => { setLang(l); langRef.current = l; if (listening.current && srOk) startSR(); };

  /**
   * Claude reads the transcript and returns an English transcript and English remarks (the original is kept separately).
   * If the AI route is not configured or fails, the local rules reader is used and a notice is shown for non-English speech.
   */
  async function readUpdate(said: string, t: Current, orig?: string) {
    setBusyText("Reading the update…");
    let e: Extracted = extract(said, t);
    let ai = "rules";
    let english = said;
    let language = ({ "hi-IN": "hi", "kn-IN": "kn" } as Record<string, string>)[langRef.current] ?? "en";
    try {
      const res = await fetch("/api/voice/extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: t.id, transcript: said, language: langRef.current }),
      });
      if (res.ok) { const j = await res.json(); e = j; ai = j.engine ?? "claude"; english = j.transcriptEn || said; language = j.language || language; }
    } catch { /* rules fallback */ }
    // forward only: status never goes back, progress never goes down, completed is final
    const rank = (x: Status) => STATUS_ORDER.indexOf(x);
    let lock: string | null = null;
    if (t.status === "completed") {
      e = { ...e, status: "completed", progress: 100 };
      lock = "This task is completed. Status and progress stay as they are; the remark is still saved.";
    } else {
      if (rank(e.status) < rank(t.status)) { e = { ...e, status: t.status }; lock = `Status stays ${STATUS[t.status].label}; it cannot go back.`; }
      if (e.progress < t.progress) e = { ...e, progress: t.progress };
    }
    setLockNote(lock);
    setNotice(ai === "rules" && (language !== "en" || /[^ -]/.test(said)) ? "Saved as spoken; English translation needs the voice service." : null);
    setOriginal(orig ?? original ?? said);
    setSpoken(language);
    setText(english);
    setEngine((x) => ({ ...x, ai }));
    setEx(e);
    setForm({ status: e.status, progress: e.progress, manpower: e.manpower == null ? "" : String(e.manpower), remarks: e.remarks });
    setPhase("confirm");
  }

  async function finish() {
    let said = (finalRef.current || text).trim() || text.trim();
    stopAll();
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((res) => { rec.onstop = () => res(); rec.stop(); });
      blobRef.current = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
    }
    setText(said); setInterim("");
    setPhase("processing");
    setBusyText("Transcribing…");
    let stt = "browser";
    // best transcript: the recorded audio goes to the speech-to-text service; the browser transcript is the fallback
    if (blobRef.current && blobRef.current.size > 1500) {
      try {
        const fd = new FormData();
        fd.append("audio", blobRef.current, "update");
        fd.append("lang", langRef.current);
        if (target) fd.append("taskId", target.id);
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
        if (res.ok) {
          const j = await res.json();
          if (j.text) { said = j.text; stt = j.model ?? "ai"; setText(said); }
        }
      } catch { /* keep the browser transcript */ }
    }
    setEngine({ stt, ai: "rules" });
    // the clip is used once and discarded: nothing is stored
    blobRef.current = null; chunks.current = [];
    if (!target) {
      const words = said.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const score = (t: TaskLite) => { const l = t.title.toLowerCase(); return words.reduce((a, w) => a + (l.includes(w) ? 1 : 0), 0); };
      const best = [...tasks].sort((a, b) => score(b) - score(a))[0];
      if (best && words.length && score(best) > 0) setTarget({ ...best, status: "not_started", progress: 0, manpower: null });
      setPhase("found");
      return;
    }
    await readUpdate(said, target, said);
  }

  // a recording is never longer than two minutes
  useEffect(() => {
    if (phase !== "listen") return;
    const t = setTimeout(() => finish(), 120_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function confirm() {
    if (!target) return;
    setSaving(true);
    try {
      const locked = target.status === "completed";
      const confirmed = {
        status: locked ? "completed" : form.status, progress: locked ? 100 : form.progress,
        manpower: form.manpower === "" ? null : Number(form.manpower), remarks: form.remarks.trim(),
      };
      const body: Record<string, unknown> = {
        type: "voice", text, confirmed,
        // text is the English transcript; the spoken original and its language are kept alongside
        extracted: { ...ex, original_transcript: original || text, language: spoken, engines: engine },
      };
      if (!locked) { body.status = form.status; body.progress = form.progress; }
      await postUpdate(target.id, body);
      toast(`Update saved to task ${target.seq}`);
      onClose();
      router.refresh();
    } catch (err) {
      toast((err as Error).message);
      setSaving(false);
    }
  }

  const low = (k: keyof Extracted["confidence"]) => !!ex && ex.confidence[k] < 0.6;
  const title = phase === "listen" ? "Listening" : phase === "processing" ? "One moment" : phase === "found" ? (target ? "Task found" : "No matching task") : "Check and confirm";

  return (
    <div className="sheet-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label="Voice update">
        <div className="grab" />
        <div className="hd"><h3>{title}</h3><button className="iconbtn" type="button" onClick={onClose} aria-label="Close"><Close /></button></div>
        <div className="ctx">
          {current ? <>Updating <b>{current.title}</b></> : phase === "found" && target ? <>Opening <b>{target.title}</b></> : <><span className="chip info"><span className="dot" />No task open</span> Say the task name to open it</>}
        </div>
        <div className="tmpl" role="group" aria-label="Language">
          {LANGS.map(([code, label]) => <button key={code} type="button" aria-pressed={lang === code} onClick={() => changeLang(code)}>{label}</button>)}
        </div>

        {phase === "listen" && (
          <div className="listen">
            <div className={`wave${micOk ? "" : " idle"}`} aria-hidden="true">
              {levels.map((l, i) => <i key={i} style={micOk ? { height: 8 + l * 34, animation: "none" } : undefined} />)}
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div className="transcript" role="status" aria-live="polite">
            {text ? <>{text}<br /></> : null}
            <span style={{ color: "var(--muted)" }}>{busyText}</span>
          </div>
        )}

        {phase === "confirm" ? (
          <div className="field">
            <label htmlFor="x-t">What was said (in English) <span className="note">· edit if needed, then Read again</span></label>
            <textarea id="x-t" value={text} onChange={(e) => setText(e.target.value)} />
            {SPOKEN[spoken] ? <div className="note">Spoken in {SPOKEN[spoken]}</div> : null}
            {notice ? <div className="warnbox" role="status"><span>{notice}</span></div> : null}
          </div>
        ) : phase === "listen" && (!srOk || !micOk) ? (
          <div className="field">
            {!micOk && <div className="note">Microphone is not available. Type the update instead.</div>}
            <textarea aria-label="Transcript" placeholder="Type the update, e.g. completed, six people" value={text} onChange={(e) => { setText(e.target.value); finalRef.current = e.target.value; }} />
          </div>
        ) : phase === "processing" ? null : (
          <div className="transcript" aria-live="polite">
            {text || interim ? <>{text} <span style={{ color: "var(--hint)" }}>{interim}</span>{phase === "listen" && <span className="cur" />}</> : <span className="ph-text">Speak now, in your own language.</span>}
          </div>
        )}

        {phase === "confirm" && ex && (
          <div className="extract">
            <div className="row"><label htmlFor="x-s">Status</label>
              <select id="x-s" value={form.status} disabled={target?.status === "completed"} onChange={(e) => setForm({ ...form, status: e.target.value as Status, progress: e.target.value === "completed" ? 100 : e.target.value === "not_started" ? 0 : form.progress })}>
                {STATUS_ORDER.map((s) => <option key={s} value={s} disabled={!!target && STATUS_ORDER.indexOf(s) < STATUS_ORDER.indexOf(target.status)}>{STATUS[s].label}</option>)}
              </select></div>
            <div className="row"><label htmlFor="x-p">Progress</label>
              <div className="inl"><input type="range" id="x-p" min={target?.status === "in_progress" ? target.progress : 0} max={100} step={5} value={form.progress} disabled={target?.status === "completed"} onChange={(e) => setForm({ ...form, progress: +e.target.value })} />
                <span className="num" style={{ fontWeight: 600, minWidth: 38, textAlign: "right" }}>{form.progress}%</span></div></div>
            <div className="row"><label htmlFor="x-m">Manpower</label>
              <input id="x-m" type="number" min={0} value={form.manpower} onChange={(e) => setForm({ ...form, manpower: e.target.value })} /></div>
            <div className="row"><label htmlFor="x-r">Remarks</label>
              <textarea id="x-r" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
            {lockNote ? <div className="conf"><span className="dot" style={{ background: "var(--warn)" }} />{lockNote}</div> : null}
            {(low("status") || low("progress") || low("manpower")) && (
              <div className="conf"><span className="dot" style={{ background: "var(--warn)" }} />Not heard clearly: {[low("status") && "status", low("progress") && "progress", low("manpower") && "manpower"].filter(Boolean).join(", ")}. Please check.</div>
            )}
            <div className="conf"><span className="dot" />The transcript is kept with this update as the record.</div>
          </div>
        )}

        <div className="acts">
          {phase === "listen" && (<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" onClick={finish} disabled={!text.trim() && !interim && srOk && micOk ? false : false}>Done speaking</button></>)}
          {phase === "found" && (target
            ? (<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" onClick={() => { onClose(); router.push(`/tasks/${target.id}?voice=1`); }}>Open and continue</button></>)
            : (<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" onClick={startListening}><Mic />Speak again</button></>))}
          {phase === "confirm" && (<>
            <button className="btn" type="button" onClick={startListening}><Mic />Speak again</button>
            <button className="btn" type="button" onClick={() => { setPhase("processing"); readUpdate(text.trim(), target!); }} disabled={!text.trim()}>Read again</button>
            <button className="btn primary" type="button" onClick={confirm} disabled={saving || !canUpdate}>{saving ? "Saving…" : "Confirm update"}</button>
          </>)}
        </div>
      </div>
    </div>
  );
}
