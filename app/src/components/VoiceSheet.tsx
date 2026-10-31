"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extract, type Extracted } from "@/lib/voice/extract";
import { STATUS, STATUS_ORDER, type Status } from "@/lib/types";
import { postUpdate, uploadAttachment } from "@/lib/upload";
import { Mic } from "./Icons";
import { Close } from "./Icons";
import { useToast } from "./Toast";

type TaskLite = { id: string; seq: number; title: string };
type Current = TaskLite & { status: Status; progress: number; manpower: number | null };
type Props = { tasks: TaskLite[]; taskId?: string; current?: Current; language: string; areaId?: string; canUpdate?: boolean };

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
function VoiceSheet({ tasks, current, language, areaId, canUpdate = true, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState<"listen" | "found" | "confirm">("listen");
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
    setPhase("listen"); setText(""); setInterim(""); finalRef.current = ""; blobRef.current = null; chunks.current = []; setEx(null);
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

  async function finish() {
    const said = (finalRef.current || text).trim() || text.trim();
    stopAll();
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((res) => { rec.onstop = () => res(); rec.stop(); });
      blobRef.current = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
    }
    setText(said); setInterim("");
    if (!target) {
      const words = said.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const score = (t: TaskLite) => { const l = t.title.toLowerCase(); return words.reduce((a, w) => a + (l.includes(w) ? 1 : 0), 0); };
      const best = [...tasks].sort((a, b) => score(b) - score(a))[0];
      if (best && words.length && score(best) > 0) setTarget({ ...best, status: "not_started", progress: 0, manpower: null });
      setPhase("found");
      return;
    }
    const e = extract(said, target);
    setEx(e);
    setForm({ status: e.status, progress: e.progress, manpower: e.manpower == null ? "" : String(e.manpower), remarks: e.remarks });
    setPhase("confirm");
  }

  async function confirm() {
    if (!target) return;
    setSaving(true);
    try {
      const confirmed = { status: form.status, progress: form.progress, manpower: form.manpower === "" ? null : Number(form.manpower), remarks: form.remarks.trim() };
      const { updateId } = await postUpdate(target.id, {
        type: "voice", status: form.status, progress: form.progress, text, extracted: ex, confirmed,
      });
      if (blobRef.current && blobRef.current.size && areaId) {
        await uploadAttachment({ areaId, taskId: target.id, updateId, kind: "audio", blob: blobRef.current, ext: "webm", durationMs: Date.now() - startedAt.current });
      }
      toast(`Update saved to task ${target.seq}`);
      onClose();
      router.refresh();
    } catch (err) {
      toast((err as Error).message);
      setSaving(false);
    }
  }

  const low = (k: keyof Extracted["confidence"]) => !!ex && ex.confidence[k] < 0.6;
  const title = phase === "listen" ? "Listening" : phase === "found" ? (target ? "Task found" : "No matching task") : "Check and confirm";

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

        {phase === "listen" && (!srOk || !micOk) ? (
          <div className="field">
            {!micOk && <div className="note">Microphone is not available, so nothing is recorded as audio. Type the update instead.</div>}
            <textarea aria-label="Transcript" placeholder="Type the update, e.g. completed, six people" value={text} onChange={(e) => { setText(e.target.value); finalRef.current = e.target.value; }} />
          </div>
        ) : (
          <div className="transcript" aria-live="polite">
            {text || interim ? <>{text} <span style={{ color: "var(--hint)" }}>{interim}</span>{phase === "listen" && <span className="cur" />}</> : <span className="ph-text">Speak now, in your own language.</span>}
          </div>
        )}

        {phase === "confirm" && ex && (
          <div className="extract">
            <div className="row"><label htmlFor="x-s">Status</label>
              <select id="x-s" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status, progress: e.target.value === "completed" ? 100 : e.target.value === "not_started" ? 0 : form.progress })}>
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
              </select></div>
            <div className="row"><label htmlFor="x-p">Progress</label>
              <div className="inl"><input type="range" id="x-p" min={0} max={100} step={5} value={form.progress} onChange={(e) => setForm({ ...form, progress: +e.target.value })} />
                <span className="num" style={{ fontWeight: 600, minWidth: 38, textAlign: "right" }}>{form.progress}%</span></div></div>
            <div className="row"><label htmlFor="x-m">Manpower</label>
              <input id="x-m" type="number" min={0} value={form.manpower} onChange={(e) => setForm({ ...form, manpower: e.target.value })} /></div>
            <div className="row"><label htmlFor="x-r">Remarks</label>
              <textarea id="x-r" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
            {(low("status") || low("progress") || low("manpower")) && (
              <div className="conf"><span className="dot" style={{ background: "var(--warn)" }} />Not heard clearly: {[low("status") && "status", low("progress") && "progress", low("manpower") && "manpower"].filter(Boolean).join(", ")}. Please check.</div>
            )}
            <div className="conf"><span className="dot" />Transcript and audio are kept with this update as evidence.</div>
          </div>
        )}

        <div className="acts">
          {phase === "listen" && (<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" onClick={finish} disabled={!text.trim() && !interim && srOk && micOk ? false : false}>Done speaking</button></>)}
          {phase === "found" && (target
            ? (<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" onClick={() => { onClose(); router.push(`/tasks/${target.id}?voice=1`); }}>Open and continue</button></>)
            : (<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" onClick={startListening}><Mic />Speak again</button></>))}
          {phase === "confirm" && (<><button className="btn" type="button" onClick={startListening}><Mic />Speak again</button><button className="btn primary" type="button" onClick={confirm} disabled={saving || !canUpdate}>{saving ? "Saving…" : "Confirm update"}</button></>)}
        </div>
      </div>
    </div>
  );
}
