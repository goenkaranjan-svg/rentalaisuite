import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function BridgePage() {
  const { userId, getToken } = await auth();
  if (!userId) {
    redirect("/");
  }

  const token = await getToken();
  if (!token) {
    redirect("/");
  }

  const mainAppUrl = process.env.MAIN_APP_URL || "http://localhost:5001";
  const callbackUrl = new URL("/api/auth/clerk/callback", mainAppUrl);
  callbackUrl.searchParams.set("token", token);
  callbackUrl.searchParams.set("redirect", "/");

  redirect(callbackUrl.toString());
}

