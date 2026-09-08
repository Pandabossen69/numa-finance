import { AnalysFirstPaint } from "@/components/layout/HemFirstPaint";
import { LoadingSlot } from "@/components/layout/LoadingSlot";

export default function AnalysLoading() {
  return (
    <LoadingSlot>
      <AnalysFirstPaint />
    </LoadingSlot>
  );
}
