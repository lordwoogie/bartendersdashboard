import { Dashboard } from "@/components/Dashboard";

// The bartender dashboard used to be the site root. The root ("/") now
// serves the public Lively Beerworks homepage (public/index.html, see the
// rewrite in next.config.ts), so the dashboard lives at /dashboard.
export default function Home() {
  return <Dashboard />;
}
