export default function Wizard({ onContinue }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <h2 className="text-2xl font-semibold mb-4 text-green-600">Database Provisioned!</h2>
      <p className="text-zinc-500 mb-8">Data successfully mapped to vector space.</p>
      <button onClick={onContinue} className="px-6 py-2 bg-zinc-900 text-white rounded-lg">Continue to Chat</button>
    </div>
  );
}