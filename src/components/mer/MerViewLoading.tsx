export function MerViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-7"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Mer"
    >
      <div className="space-y-2">
        <div className="numa-skel h-8 w-16" />
        <div className="numa-skel h-4 w-44" />
      </div>
      <div className="space-y-6">
        <MerSectionSkel rows={1} titleWidth="w-40" />
        <MerSectionSkel rows={2} titleWidth="w-16" />
        <MerSectionSkel rows={2} titleWidth="w-20" />
        <MerSectionSkel rows={2} titleWidth="w-12" />
      </div>
    </div>
  );
}

export function SettingsViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-7"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Inställningar"
    >
      <div className="space-y-3">
        <div className="numa-skel h-5 w-12" />
        <div className="numa-skel h-8 w-40" />
      </div>
      <div className="space-y-6">
        <MerSectionSkel rows={1} titleWidth="w-28" />
        <MerSectionSkel rows={4} titleWidth="w-14" />
      </div>
    </div>
  );
}

export function ImporteraViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-7"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Tidigare bilder"
    >
      <div className="space-y-3">
        <div className="numa-skel h-5 w-12" />
        <div className="numa-skel h-8 w-44" />
      </div>
      <div className="space-y-2">
        <div className="numa-panel-list">
          <div className="px-4 py-3.5">
            <div className="numa-skel h-4 w-2/3 rounded-md" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="numa-skel h-3 w-16 rounded-md" />
        <div className="numa-panel-list divide-y divide-[var(--numa-border)]">
          <ImporteraRowSkel />
          <ImporteraRowSkel />
          <ImporteraRowSkel />
        </div>
      </div>
    </div>
  );
}

function MerSectionSkel({
  rows,
  titleWidth,
}: {
  rows: number;
  titleWidth: string;
}) {
  return (
    <div className="space-y-2">
      <div className={`numa-skel h-3 ${titleWidth}`} />
      <div className="numa-panel-list divide-y divide-[var(--numa-border)]">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="px-4 py-3.5">
            <div className="numa-skel h-4 w-28" />
            <div className="numa-skel mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ImporteraRowSkel() {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="numa-skel h-4 w-20 rounded-md" />
        <div className="numa-skel h-5 w-16 rounded-md" />
      </div>
      <div className="numa-skel mt-2 h-3 w-28 rounded-md" />
    </div>
  );
}
