// Capability tags shown next to a model. These are deliberately conservative:
// every catalog entry here is a text agent unless its id/label names a known
// media or reasoning family. They are a UI hint, not a provider contract.
export const MODEL_CAPABILITIES = [
  "text",
  "vision",
  "audio",
  "image",
  "video",
  "reasoning",
] as const;

export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

const VISION = /(vision|multimodal|(?:^|[-_/ ])(?:vl|omni)(?:$|[-_/ .])|\bclaude\b|\bgpt-[45]\b|\bgpt-4o\b|\bgemini\b|\bgrok\b|nemotron.*vl)/i;
const AUDIO = /(audio|realtime|voice|speech|whisper|\btts\b|omni|gemini.*live)/i;
const IMAGE = /(image|imagine|dall-?e|flux|diffusion|sdxl|midjourney|ideogram|recraft|seedream)/i;
const VIDEO = /(video|sora|\bveo\b|kling|runway|heygen|pika|luma)/i;
const REASONING = /(thinking|reason|deepseek.*r1|(?:^|[-_/ ])o[134](?:$|[-_/ .])|gpt-5.*(?:pro|thinking))/i;

/** Output/input affordances a model can be expected to handle. */
export function modelCapabilities(option: { id: string; label?: string; group?: string }): ModelCapability[] {
  const name = `${option.id} ${option.label ?? ""} ${option.group ?? ""}`;
  const found = new Set<ModelCapability>(["text"]);
  if (VISION.test(name)) found.add("vision");
  if (AUDIO.test(name)) found.add("audio");
  if (IMAGE.test(name)) found.add("image");
  if (VIDEO.test(name)) found.add("video");
  if (REASONING.test(name)) found.add("reasoning");
  return MODEL_CAPABILITIES.filter((capability) => found.has(capability));
}

export const MODEL_CAPABILITY_LABELS: Record<ModelCapability, string> = {
  text: "Text",
  vision: "Vision",
  audio: "Audio",
  image: "Image generation",
  video: "Video generation",
  reasoning: "Reasoning",
};
