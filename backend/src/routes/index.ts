import { Router } from "express";

import { adminRouter } from "./admin";
import { appointmentsRouter } from "./appointments";
import { authRouter } from "./auth";
import { availabilityRouter } from "./availability";
import { chatRouter } from "./chat";
import { servicesRouter } from "./services";
import { uploadsRouter } from "./uploads";

export const apiRouter = Router();

apiRouter.get("/ping", (_req, res) => {
  res.json({ status: "ok" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/services", servicesRouter);
apiRouter.use("/availability", availabilityRouter);
apiRouter.use("/appointments", appointmentsRouter);
apiRouter.use("/uploads", uploadsRouter);
apiRouter.use("/admin", adminRouter);
