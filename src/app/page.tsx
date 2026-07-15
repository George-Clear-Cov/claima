import { getSession } from "@/lib/auth"
import Marketing from "@/components/marketing/Marketing"
import HomeDashboard from "./HomeDashboard"

// Auth is resolved on the server from the session cookie. Anonymous visitors
// get the fully server-rendered marketing page (crawlable + shareable, no
// blank first paint); authenticated users get their dashboard. Reading the
// cookie makes this route dynamic, which is intended.
export default async function Home() {
  const session = await getSession()
  return session ? <HomeDashboard /> : <Marketing />
}
