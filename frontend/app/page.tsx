import { redirect } from "next/navigation";

export default function RootPage() {
  // Redirect to Swedish locale by default (primary market)
  redirect("/sv");
}
