import type { Metadata } from "next";
import { Suspense } from "react";
import { TvBoard } from "@/components/production/TvBoard";

export const metadata: Metadata = {
  title: "Lively Production — TV",
  description: "The week's production board, sized for a wall screen.",
};

export default function ProductionTv() {
  return (
    <Suspense fallback={null}>
      <TvBoard />
    </Suspense>
  );
}
