import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex items-center gap-3">
        <Image src="/logo.svg" alt="" width={48} height={48} priority />
        <h1 className="text-3xl font-semibold tracking-tight">Specify</h1>
      </div>
      <p className="max-w-md text-center text-muted-foreground">
        Learn plant names and characteristics, one quiz at a time.
      </p>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Under construction</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Scaffold + design system in place (SPEC-003). Auth, the quiz engine, and
            everything else land next.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge>Learning</Badge>
            <Badge variant="secondary">Intermediate</Badge>
            <Badge className="bg-success text-success-foreground">Correct</Badge>
            <Badge variant="destructive">Incorrect</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
