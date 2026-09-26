"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useRequest } from "@/context/RequestContext";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

const RecorderContext = createContext<ReturnType<typeof useAudioRecorder> | null>(null);

export function RecorderProvider({ children }: { children: React.ReactNode }) {
  const { setAudio } = useRequest();
  const recorder = useAudioRecorder(setAudio);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const cancel = recorder.cancel;
  const phase = recorder.phase;

  useEffect(() => {
    const leftRecord = previousPath.current === "/record" && pathname !== "/record";
    previousPath.current = pathname;
    if (leftRecord && (phase === "recording" || phase === "starting")) {
      cancel();
    }
  }, [cancel, pathname, phase]);

  return <RecorderContext.Provider value={recorder}>{children}</RecorderContext.Provider>;
}

export function useRecorder() {
  const value = useContext(RecorderContext);
  if (!value) {
    throw new Error("useRecorder must be used within RecorderProvider");
  }
  return value;
}
