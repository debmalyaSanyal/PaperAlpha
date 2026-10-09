import Link from "next/link";

export default function WorkspaceEntry() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f9fc] px-5 text-center">
      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-950">PaperAlpha Workspace</h1>
        <p className="mt-4 leading-7 text-slate-600">
          The editable workspace opens automatically after generation so it can use your temporary in-browser research state without permanent storage.
        </p>
        <Link href="/generate" className="mt-6 inline-flex rounded-md bg-cyan-600 px-5 py-3 text-sm font-semibold text-white">
          Open Generation Wizard
        </Link>
      </div>
    </main>
  );
}
