import { MainFirstPaint } from "@/components/layout/HemFirstPaint";
import { LoadingSlot } from "@/components/layout/LoadingSlot";

export default function MainLoading() {
  return (
    <LoadingSlot>
      <MainFirstPaint />
    </LoadingSlot>
  );
}
