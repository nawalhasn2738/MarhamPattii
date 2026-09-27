"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateAudioBlob } from "@/lib/audio";

const MAX_SECONDS = 60;

export type RecorderPhase =
  | "idle"
  | "starting"
  | "recording"
  | "denied"
  | "unavailable"
  | "unsupported"
  | "too-short"
  | "silent"
  | "invalid-audio"
  | "error";

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useAudioRecorder(onComplete: (blob: Blob, durationSeconds: number) => void) {
  const onCompleteRef = useRef(onComplete);

  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [take, setTake] = useState(0);

  const generationRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const stoppedByUserRef = useRef(false);
  const aliveRef = useRef(true);
  const levelTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const loudFramesRef = useRef(0);
  const measuredRef = useRef(false);
  const stopRequestedRef = useRef(false);

  const releaseStream = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (levelTimerRef.current !== null) {
      window.clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    stoppedByUserRef.current = false;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.stop();
    }
    releaseStream();
    setPhase("idle");
    setSeconds(0);
  }, [releaseStream]);

  const start = useCallback(async () => {
    cancel();
    const token = generationRef.current;
    chunksRef.current = [];
    stoppedByUserRef.current = false;
    loudFramesRef.current = 0;
    measuredRef.current = false;
    stopRequestedRef.current = false;
    setSeconds(0);
    setPhase("starting");

    let primedContext: AudioContext | null = null;
    try {
      primedContext = new AudioContext();
      void primedContext.resume();
    } catch {
      primedContext = null;
    }
    audioContextRef.current = primedContext;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      void primedContext?.close();
      audioContextRef.current = null;
      setPhase("unsupported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!aliveRef.current || generationRef.current !== token) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      try {
        const context = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = context;
        if (context.state === "suspended") await context.resume();
        if (context.state === "suspended") throw new Error("audio context suspended");
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        measuredRef.current = true;
        levelTimerRef.current = window.setInterval(() => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const centered = (samples[index] - 128) / 128;
            sum += centered * centered;
          }
          if (Math.sqrt(sum / samples.length) >= 0.02) loudFramesRef.current += 1;
        }, 100);
      } catch {
        measuredRef.current = false;
      }

      if (!aliveRef.current || generationRef.current !== token) {
        releaseStream();
        return;
      }

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const elapsedMs = Date.now() - startedAtRef.current;
        const durationSeconds = Math.max(1, Math.round(elapsedMs / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        recorderRef.current = null;
        const silent = measuredRef.current && loudFramesRef.current === 0;
        releaseStream();
        if (!stoppedByUserRef.current || !aliveRef.current) return;
        const validation = validateAudioBlob(blob);
        if (!validation.ok) {
          setPhase(validation.code === "audio_too_small" ? "too-short" : "invalid-audio");
          return;
        }
        if (elapsedMs < 1000) {
          setPhase("too-short");
          return;
        }
        if (silent) {
          setPhase("silent");
          return;
        }
        setPhase("idle");
        setTake((current) => current + 1);
        onCompleteRef.current(blob, durationSeconds);
      };

      try {
        recorder.start(250);
      } catch {
        recorder.start();
      }
      if (stopRequestedRef.current) {
        stoppedByUserRef.current = true;
        recorder.stop();
        return;
      }
      startedAtRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(elapsed);
        if (elapsed < MAX_SECONDS) return;
        const active = recorderRef.current;
        if (!active || active.state !== "recording") return;
        stoppedByUserRef.current = true;
        active.stop();
      }, 200);
      setPhase("recording");
    } catch (error) {
      releaseStream();
      if (!aliveRef.current || generationRef.current !== token) return;
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        setPhase("denied");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "NotReadableError") {
        setPhase("unavailable");
      } else {
        setPhase("error");
      }
    }
  }, [cancel, releaseStream]);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    stoppedByUserRef.current = true;
    if (typeof recorder.requestData === "function") recorder.requestData();
    recorder.stop();
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      cancel();
    };
  }, [cancel]);

  return { phase, seconds, take, start, stop, cancel };
}
