import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const CHUNK_SIZE = 8;

export function loadLocalEnv(cwd = process.cwd()) {
  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith("#")) {
      return;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  });
}

function extractOutputText(payload) {
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function stripCodeFence(value) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
}

function parseJsonOutput(payload) {
  const text = stripCodeFence(extractOutputText(payload));

  if (!text) {
    throw new Error("OpenAI did not return any analysis text.");
  }

  return JSON.parse(text);
}

async function callOpenAI(body) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for live monitor analysis.");
  }

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "OpenAI request failed.");
  }

  return payload;
}

function chunkScreenshots(items, size = CHUNK_SIZE) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildChunkSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      observations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            timestamp: { type: "string" },
            teacher_visible: { type: "boolean" },
            activity_label: { type: "string" },
            zone: { type: "string" },
            engagement_level: {
              type: "string",
              enum: ["high", "moderate", "low", "unknown"]
            },
            phone_usage_flag: { type: "boolean" },
            summary: { type: "string" },
            confidence: { type: "number" }
          },
          required: [
            "timestamp",
            "teacher_visible",
            "activity_label",
            "zone",
            "engagement_level",
            "phone_usage_flag",
            "summary",
            "confidence"
          ]
        }
      }
    },
    required: ["observations"]
  };
}

function buildFinalSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      overall_summary: { type: "string" },
      teacher_activity_summary: { type: "string" },
      final_assessment: { type: "string" },
      teacher_presence_summary: { type: "string" },
      attention_points: {
        type: "array",
        items: { type: "string" }
      },
      key_findings: {
        type: "array",
        items: { type: "string" }
      },
      timeline: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            start_time: { type: "string" },
            end_time: { type: "string" },
            summary: { type: "string" }
          },
          required: ["start_time", "end_time", "summary"]
        }
      }
    },
    required: [
      "overall_summary",
      "teacher_activity_summary",
      "final_assessment",
      "teacher_presence_summary",
      "attention_points",
      "key_findings",
      "timeline"
    ]
  };
}

async function analyzeChunk(session, screenshots) {
  const content = [
    {
      type: "input_text",
      text:
        `You are analyzing classroom monitor screenshots for a Nepali government school.\n` +
        `Teacher: ${session.teacherName}\n` +
        `Subject: ${session.subject}\n` +
        `Class: ${session.grade} ${session.section}\n` +
        `Room: ${session.room}\n` +
        `The teacher is the primary subject of analysis. Focus on what the teacher is visibly doing, where the teacher is standing or sitting, whether the teacher is visible, and any possible phone usage or inactivity.\n` +
        `Do not describe students unless it is necessary to explain the teacher's orientation, such as facing students.\n` +
        `For each screenshot, identify only visible facts from the frame. Do not invent motion you cannot infer from the image.\n` +
        `Each per-frame summary should begin with "Teacher".`
    }
  ];

  screenshots.forEach((screenshot, index) => {
    content.push({
      type: "input_text",
      text:
        `Screenshot ${index + 1} timestamp: ${screenshot.capturedAt}\n` +
        `Return one observation for this exact timestamp.`
    });
    content.push({
      type: "input_image",
      image_url: screenshot.imageUrl
    });
  });

  const payload = await callOpenAI({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "live_monitor_chunk_analysis",
        strict: true,
        schema: buildChunkSchema()
      }
    }
  });

  return parseJsonOutput(payload).observations;
}

async function analyzeFinalReport(session, observations) {
  const payload = await callOpenAI({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Create a final timestamped classroom activity report from the observation list.\n` +
              `Teacher: ${session.teacherName}\n` +
              `Subject: ${session.subject}\n` +
              `Class: ${session.grade} ${session.section}\n` +
              `Room: ${session.room}\n` +
              `Your primary focus is the teacher, not the students.\n` +
              `Summarize only the teacher's visible presence, position, activity, inactivity, off-frame periods, and possible phone use over time.\n` +
              `Use plain administrative language and treat this as classroom activity analytics rather than a judgment of teaching quality.\n` +
              `overall_summary should be a clear teacher-centered paragraph.\n` +
              `teacher_activity_summary should explain what the teacher mainly did across the session.\n` +
              `teacher_presence_summary should clearly state how consistently the teacher stayed visible in frame.\n` +
              `final_assessment should be a practical admin takeaway, not a quality score.\n` +
              `attention_points should list noteworthy concerns or review points. Use an empty array if none are visible.\n` +
              `key_findings should list the most important teacher observations in short bullet-style sentences.\n` +
              `Each timeline summary should begin with "Teacher" and describe the teacher's observed action during that time range.\n\n` +
              `Observation data:\n${JSON.stringify(observations)}`
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "live_monitor_final_report",
        strict: true,
        schema: buildFinalSchema()
      }
    }
  });

  return parseJsonOutput(payload);
}

export async function analyzeLiveMonitorSession({ session, screenshots }) {
  if (!session?.id || !session?.teacherName) {
    throw new Error("Session metadata is required.");
  }

  if (!Array.isArray(screenshots) || !screenshots.length) {
    throw new Error("At least one screenshot is required for analysis.");
  }

  const chunked = chunkScreenshots(screenshots, CHUNK_SIZE);
  const observations = [];

  for (const chunk of chunked) {
    const chunkObservations = await analyzeChunk(session, chunk);
    observations.push(...chunkObservations);
  }

  const report = await analyzeFinalReport(session, observations);

  return {
    generatedAt: new Date().toISOString(),
    observations,
    report
  };
}
