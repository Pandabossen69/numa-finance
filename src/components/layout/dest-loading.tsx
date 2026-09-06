import {
  AnalysViewLoading,
  HomeViewLoading,
  ViewLoading,
} from "@/components/layout/ViewLoading";
import { MerViewLoading } from "@/components/mer/MerViewLoading";

export function destLoadingForTab(tab: string | null) {
  switch (tab) {
    case "/idag":
      return <HomeViewLoading />;
    case "/analys":
      return <AnalysViewLoading />;
    case "/mer":
      return <MerViewLoading />;
    default:
      return <ViewLoading />;
  }
}
