import { Link } from "react-router";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="animate-fade-up">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft">
          <Compass className="h-7 w-7 text-accent" />
        </span>

        <p className="eyebrow">Error 404</p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-foreground sm:text-5xl">
          This page wandered off
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          The page you're looking for doesn't exist, or it may have moved
          somewhere else in the shop.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to shop
          </Link>
          <Link to="/shops" className="btn-outline">
            Browse shops
          </Link>
        </div>
      </div>
    </div>
  );
}
