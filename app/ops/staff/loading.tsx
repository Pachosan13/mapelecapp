export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-8">
        <div className="h-4 w-32 rounded-full bg-gray-200" />
        <div className="mt-4 h-7 w-48 rounded-full bg-gray-200" />
        <div className="mt-2 h-4 w-64 rounded-full bg-gray-200" />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="px-6 py-5">
              <div className="h-4 w-40 rounded-full bg-gray-200" />
              <div className="mt-3 h-3 w-20 rounded-full bg-gray-100" />
              <div className="mt-4 h-9 w-56 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
