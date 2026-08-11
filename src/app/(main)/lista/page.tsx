import { redirect } from "next/navigation";

/** Legacy path — land on Rörelser (transaction list). */
export default function ListaRedirectPage() {
  redirect("/transaktioner");
}
