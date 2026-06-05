import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">MediBill</h1>
          <p className="text-gray-400 text-lg">
            AI-native medical billing for mental health practices
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-10">
          <Link
            href="/claims"
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500 transition-colors text-left"
          >
            <div className="text-2xl mb-2">📋</div>
            <h2 className="font-semibold text-lg">Claims</h2>
            <p className="text-gray-400 text-sm mt-1">
              Submit and track insurance claims
            </p>
          </Link>

          <Link
            href="/claims/new"
            className="bg-blue-600 rounded-xl p-6 hover:bg-blue-500 transition-colors text-left"
          >
            <div className="text-2xl mb-2">➕</div>
            <h2 className="font-semibold text-lg">New Claim</h2>
            <p className="text-blue-200 text-sm mt-1">
              Submit a claim for a patient visit
            </p>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
          <Link href="/denials" className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-red-500 transition-colors text-left">
            <div className="text-gray-400">Denial Management</div>
            <div className="text-xs text-red-500 mt-1 font-medium">4 open</div>
          </Link>
          <Link href="/eligibility" className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-green-500 transition-colors text-left">
            <div className="text-gray-400">Eligibility Check</div>
            <div className="text-xs text-green-500 mt-1 font-medium">270/271 live</div>
          </Link>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400">Patient Billing</div>
            <div className="text-xs text-gray-600 mt-1">Coming soon</div>
          </div>
        </div>
      </div>
    </main>
  )
}
