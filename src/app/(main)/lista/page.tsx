import { redirect } from "next/navigation";

/** Legacy/wrong path — always land on the real home. */
export default function ListaRedirectPage() {
  redirect("/idag");
}
