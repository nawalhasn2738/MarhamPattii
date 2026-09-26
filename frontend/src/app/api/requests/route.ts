
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const AUDIO_BUCKET = "audio-recordings";

type PipelineIntent = {
  intent?: string;
  duration?: string | null;
  urgency?: string;
  requires_human?: boolean;
  summary_for_provider?: string;
  summary_english?: string;
  summary_urdu?: string;
};

type PipelineResult = {
  status?: string;
  error?: string;
  transcript?: string | null;
  intent?: PipelineIntent | null;
  note?: string;
  llm_model?: string;
};

class PipelineExecutionError extends Error {
  status: number;
  code: string;
  details?: string;

  constructor(message: string, code: string, status = 500, details?: string) {
    super(message);
    this.name = "PipelineExecutionError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createServerSupabaseClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getSafeExtension(filename: string, mimeType: string): string {
  const extension = path.extname(filename).toLowerCase();

  if (extension && /^[a-z0-9.]+$/.test(extension)) {
    return extension;
  }

  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mpeg")) return ".mp3";
  if (mimeType.includes("mp4")) return ".m4a";
  if (mimeType.includes("wav")) return ".wav";

  return ".wav";
}

function parsePipelineStdout(stdout: string): PipelineResult {
  if (!stdout.trim()) {
    throw new PipelineExecutionError(
      "Python ASR pipeline returned no output.",
      "pipeline_empty_output",
      502,
    );
  }

  try {
    return JSON.parse(stdout.trim()) as PipelineResult;
  } catch (error) {
    console.error("Invalid Python ASR JSON:", stdout);
    throw new PipelineExecutionError(
      "Python ASR pipeline returned invalid JSON.",
      "pipeline_invalid_json",
      502,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function normalizePipelineProcessError(error: unknown): PipelineExecutionError {
  const processError = error as {
    code?: string;
    killed?: boolean;
    signal?: string;
    stdout?: string;
    stderr?: string;
    message?: string;
  };
  const stderr = processError.stderr?.trim() ?? "";
  const message = processError.message ?? "Python ASR pipeline failed.";

  if (processError.code === "ENOENT") {
    return new PipelineExecutionError(
      "Python executable was not found. Set PYTHON_BIN or install Python.",
      "python_not_found",
      500,
      message,
    );
  }

  if (processError.killed || processError.signal === "SIGTERM") {
    return new PipelineExecutionError(
      "Python ASR pipeline timed out.",
      "pipeline_timeout",
      504,
      stderr || message,
    );
  }

  if (stderr.includes("ModuleNotFoundError") || stderr.includes("ImportError")) {
    return new PipelineExecutionError(
      "Python ASR dependencies are missing. Install ai-service/requirements.txt.",
      "python_dependency_missing",
      500,
      stderr,
    );
  }

  return new PipelineExecutionError(
    "Python ASR pipeline failed.",
    "pipeline_process_failed",
    502,
    stderr || message,
  );
}

async function runPythonPipeline(audioPath: string): Promise<PipelineResult> {
  const aiServiceRoot = path.resolve(process.cwd(), "..", "ai-service");
  const scriptPath = path.join(aiServiceRoot, "src", "run_pipeline_json.py");
  const localVenvPython = path.join(aiServiceRoot, "venv", "Scripts", "python.exe");
  const hfHome = path.join(aiServiceRoot, ".hf-home");
  const pythonBin = process.env.PYTHON_BIN ?? (existsSync(localVenvPython) ? localVenvPython : "python");
  const options = {
    cwd: aiServiceRoot,
    env: {
      ...process.env,
      HF_HOME: process.env.HF_HOME ?? hfHome,
      HF_HUB_CACHE: process.env.HF_HUB_CACHE ?? path.join(hfHome, "hub"),
      HF_HUB_DISABLE_XET: process.env.HF_HUB_DISABLE_XET ?? "1",
      HF_HUB_DISABLE_SYMLINKS_WARNING: process.env.HF_HUB_DISABLE_SYMLINKS_WARNING ?? "1",
    },
    maxBuffer: 1024 * 1024 * 10,
    timeout: 1000 * 60 * 15,
    windowsHide: true,
  };

  try {
    const { stdout, stderr } = await execFileAsync(pythonBin, [scriptPath, audioPath], options);

    if (stderr.trim()) {
      console.warn("Python ASR stderr:", stderr.trim());
    }

    return parsePipelineStdout(stdout);
  } catch (error) {
    const failedProcess = error as { stdout?: string; stderr?: string };

    if (failedProcess.stderr?.trim()) {
      console.warn("Python ASR stderr:", failedProcess.stderr.trim());
    }

    if (failedProcess.stdout?.trim()) {
      return parsePipelineStdout(failedProcess.stdout);
    }

    throw normalizePipelineProcessError(error);
  }
}

export async function POST(request: Request) {
  let tempAudioPath: string | null = null;

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const languageValue = formData.get("language");
    const language =
      typeof languageValue === "string" && languageValue.trim()
        ? languageValue.trim()
        : "Balti";

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Audio file is required." },
        { status: 400 },
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const extension = getSafeExtension(audio.name, audio.type);
    const uniqueName = `request-${Date.now()}-${crypto.randomUUID()}${extension}`;
    const tempDir = path.join(process.cwd(), "tmp", "uploads");
    tempAudioPath = path.join(tempDir, uniqueName);

    await mkdir(tempDir, { recursive: true });
    await writeFile(tempAudioPath, audioBuffer);

    const pipelineResult = await runPythonPipeline(tempAudioPath);

    if (pipelineResult.status === "error") {
      return NextResponse.json(
        {
          success: false,
          error: pipelineResult.error ?? "AI pipeline failed.",
          code: "pipeline_error",
          pipeline: pipelineResult,
        },
        { status: 500 },
      );
    }

    if (pipelineResult.status === "asr_failed") {
      return NextResponse.json(
        {
          success: false,
          error: pipelineResult.error ?? "Could not transcribe audio.",
          code: "asr_failed",
          pipeline: pipelineResult,
        },
        { status: 422 },
      );
    }

    const supabase = createServerSupabaseClient();
    const storagePath = `${Date.now()}-${crypto.randomUUID()}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(storagePath, audioBuffer, {
        contentType: audio.type || "audio/wav",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase audio upload failed:", uploadError);

      const isAccessDenied =
        uploadError.message.includes("row-level security") ||
        uploadError.message.includes("AccessDenied") ||
        uploadError.name === "StorageApiError";

      return NextResponse.json(
        {
          success: false,
          error: isAccessDenied
            ? "Supabase Storage denied the audio upload. Add a storage policy or set SUPABASE_SERVICE_ROLE_KEY."
            : "Failed to upload audio.",
          code: isAccessDenied ? "storage_access_denied" : "storage_upload_failed",
          details: uploadError.message,
        },
        { status: isAccessDenied ? 403 : 500 },
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(storagePath);

    const intent = pipelineResult.intent ?? null;
    const transcript = pipelineResult.transcript ?? "";

    const { data: insertedRequest, error: insertError } = await supabase
      .from("requests")
      .insert({
        language,
        audio_url: publicUrlData.publicUrl,
        transcript,
        intent: intent?.intent ?? "unclear",
        urgency: intent?.urgency ?? "unknown",
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase request insert failed:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to save request." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      request: insertedRequest,
      ai: {
        status: pipelineResult.status,
        transcript,
        intent,
        llm_model: pipelineResult.llm_model,
        note: pipelineResult.note,
      },
    });
  } catch (error) {
    console.error("Request processing failed:", error);

    if (error instanceof PipelineExecutionError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 },
    );
  } finally {
    if (tempAudioPath) {
      await unlink(tempAudioPath).catch((error) => {
        console.warn("Failed to remove temp audio file:", error);
      });
    }
  }
}