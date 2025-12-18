export default function Privacy() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>

      <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-300">
        <p className="text-neutral-300">
          <span className="font-semibold text-white">Summary:</span> We process images to remove backgrounds and return
          results. We do not sell your images.
        </p>

        <h2 className="mt-6 text-base font-semibold text-white">Advertising</h2>
        <p className="mt-2 text-neutral-300">
          If ads are enabled, third-party vendors (including Google) may use cookies or similar identifiers to serve ads.
          You can learn more in Google’s advertising and privacy resources and adjust ad personalization in Google
          settings.
        </p>

        <h2 className="mt-6 text-base font-semibold text-white">Contact</h2>
        <p className="mt-2 text-neutral-300">Questions? Use the Contact page.</p>
      </div>
    </div>
  );
}
