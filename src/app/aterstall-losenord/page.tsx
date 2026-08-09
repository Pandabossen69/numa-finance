import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export const metadata: Metadata = {
  title: "Välj nytt lösenord — NUMA",
};

export default function AterstallLosenordPage() {
  return <UpdatePasswordForm />;
}
