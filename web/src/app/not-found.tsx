"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[var(--muted)]">
          <p>The page you requested does not exist or is no longer available.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
