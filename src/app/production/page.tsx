import type { Metadata } from "next";
import { ProductionPage } from "@/components/production/ProductionPage";

export const metadata: Metadata = {
  title: "Lively Production Schedule",
  description: "The brewery's weekly production board: canning, cellar, prep, brew, and who's in.",
};

export default function Production() {
  return <ProductionPage />;
}
