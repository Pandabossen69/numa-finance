export default function OnboardingLoading() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-6 md:flex-none md:w-full"
      aria-busy="true"
      aria-label="Laddar"
    >
      <div className="space-y-2 px-0.5">
        <div className="numa-skel h-3 w-24" />
        <div className="numa-skel h-9 w-48" />
        <div className="numa-skel h-4 w-40" />
      </div>
      <div className="mt-auto grid min-w-0 gap-3 pb-1 md:mt-8 md:grid-cols-2 md:gap-4">
        <div className="numa-skel h-[4.5rem] w-full md:h-32" />
        <div className="numa-skel h-[4.5rem] w-full md:h-32" />
      </div>
    </div>
  );
}
