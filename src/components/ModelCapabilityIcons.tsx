import { Brain, Eye, Image as ImageIcon, Type, Video, Volume2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  MODEL_CAPABILITY_LABELS,
  modelCapabilities,
  type ModelCapability,
} from "@/lib/model-capabilities";
import { cn } from "@/lib/cn";

const ICONS = {
  text: Type,
  vision: Eye,
  audio: Volume2,
  image: ImageIcon,
  video: Video,
  reasoning: Brain,
} as const;

export function ModelCapabilityIcons({
  option,
  className,
}: {
  option: { id: string; label?: string; group?: string };
  className?: string;
}) {
  const { t } = useI18n();
  const capabilities = modelCapabilities(option);
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-ink-secondary/70", className)}>
      {capabilities.map((capability: ModelCapability) => {
        const Icon = ICONS[capability];
        const label = t(MODEL_CAPABILITY_LABELS[capability]);
        return (
          <span key={capability} title={label} aria-label={label} role="img">
            <Icon size={11} strokeWidth={2} />
          </span>
        );
      })}
    </span>
  );
}
