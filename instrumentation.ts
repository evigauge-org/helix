export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installGlobalDispatcher } = await import("./lib/net/dispatcher");
    installGlobalDispatcher();
  }
}
