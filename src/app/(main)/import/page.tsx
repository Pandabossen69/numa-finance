import { redirect } from "next/navigation";

/** Old English URL — send people to Fota inside the app shell. */
export default function ImportRedirectPage() {
  redirect("/fota");
}
