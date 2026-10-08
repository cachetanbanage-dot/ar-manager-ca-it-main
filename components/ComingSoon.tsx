// A temporary page for areas not built yet, so no navigation link is broken.
export function ComingSoon({ title, step }: { title: string; step: number }) {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
      <p className="text-slate-600">Coming in build step {step}.</p>
    </div>
  );
}
