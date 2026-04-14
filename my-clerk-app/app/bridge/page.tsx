import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function BridgePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, getToken } = await auth();

  const searchParams = await props.searchParams;
  const role = typeof searchParams.role === "string" ? searchParams.role : "tenant";

  // Not signed into Clerk yet — send them to Clerk sign-in,
  // then bring them back to /bridge to complete the flow
  if (!userId) {
    const bridgeUrl = `/bridge?role=${role}`;
    redirect(`/sign-in?redirect_url=${encodeURIComponent(bridgeUrl)}`);
  }

  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }

  const mainAppUrl = process.env.MAIN_APP_URL || "http://localhost:5001";
  const callbackUrl = new URL("/api/auth/clerk/callback", mainAppUrl);
  callbackUrl.searchParams.set("token", token);
  callbackUrl.searchParams.set("redirect", "/");
  callbackUrl.searchParams.set("role", role);

  redirect(callbackUrl.toString());
}
