import { createApp } from "./api/app.js";
import { bootstrap, config } from "./bootstrap.js";
const dependencies = await bootstrap();
const app = await createApp({
  ...dependencies,
  origin: config.FRONTEND_ORIGIN,
  logger: true,
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
await app.listen({ host: config.HOST, port: config.PORT });
