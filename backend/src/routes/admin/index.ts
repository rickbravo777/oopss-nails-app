import { Router } from "express";

import { requireAdminAuth } from "../../middleware/requireAdminAuth";
import { adminAppointmentsRouter } from "./appointments";
import { adminConversationsRouter } from "./conversations";
import { adminServiceCategoriesRouter } from "./serviceCategories";
import { adminServicesRouter } from "./services";
import { adminSpecialistsRouter } from "./specialists";
import { credentialsRouter } from "./credentials";
import { dashboardRouter } from "./dashboard";
import { escalationsRouter } from "./escalations";
import { knowledgeBaseRouter } from "./knowledgeBase";

export const adminRouter = Router();

// Every route nested under /admin requires a valid admin JWT — enforced once here rather
// than per sub-router, so a future addition can't accidentally forget the guard.
adminRouter.use(requireAdminAuth);

adminRouter.use("/credentials", credentialsRouter);
adminRouter.use("/dashboard", dashboardRouter);
adminRouter.use("/services", adminServicesRouter);
adminRouter.use("/service-categories", adminServiceCategoriesRouter);
adminRouter.use("/specialists", adminSpecialistsRouter);
adminRouter.use("/appointments", adminAppointmentsRouter);
adminRouter.use("/knowledge-base", knowledgeBaseRouter);
adminRouter.use("/escalations", escalationsRouter);
adminRouter.use("/conversations", adminConversationsRouter);
