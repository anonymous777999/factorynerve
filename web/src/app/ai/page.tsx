import { redirect } from "next/navigation";

export default function AiRoutePage() {
  redirect("/premium/dashboard?notice=ai-coming-soon");
}
