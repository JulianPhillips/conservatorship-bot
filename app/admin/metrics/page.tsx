import { getPlanLogs } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default function MetricsPage() {
  const logs = getPlanLogs();

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Plan run metrics (dev only)</h1>
      <p className="text-sm text-gray-600 mb-4">
        In-memory log of ConservatorshipPlan generations since last server
        start.
      </p>
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Time</th>
            <th className="border px-2 py-1">County</th>
            <th className="border px-2 py-1">Concerns</th>
            <th className="border px-2 py-1">Had POA</th>
            <th className="border px-2 py-1">Summary preview</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="border px-2 py-1">{log.timestamp}</td>
              <td className="border px-2 py-1">{log.personCounty}</td>
              <td className="border px-2 py-1">{log.concerns.join(", ")}</td>
              <td className="border px-2 py-1">
                {log.hadPOA ? "Yes" : "No"}
              </td>
              <td className="border px-2 py-1">{log.summaryPreview}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
